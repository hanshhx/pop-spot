'use client';

import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '@/lib/api';
import { getAuthToken } from '@/lib/authStorage';

/**
 * 인증된 SSE 스트림 구독 훅.
 *
 * - `EventSource` 는 헤더를 못 보내므로 토큰을 쿼리 파라미터로 첨부 (백엔드가 SSE 경로만 허용).
 * - 끊기면 exponential backoff (1s → 2s → 4s → 8s → 16s, max 30s).
 * - `paused === true` 면 새 이벤트 수신 즉시 onMessage 호출 안 함 (라이브 일시정지).
 * - 컴포넌트 unmount 시 자동 close.
 */
interface UseSseStreamOptions {
  /** 백엔드 SSE 경로 — 예: "/api/admin/logs/stream" */
  path: string;
  /** 서버에서 보내는 event name — "log" 같은 named event */
  eventName: string;
  /** 새 이벤트 수신 콜백. paused 일 때는 호출되지 않음. */
  onMessage: (data: string) => void;
  /** paused 여부 — true 면 onMessage 미호출 (단 연결은 유지) */
  paused?: boolean;
  /** false 면 EventSource 미생성 (로그 탭 닫혀 있을 때 등) */
  enabled?: boolean;
}

type Status = 'connecting' | 'open' | 'closed' | 'error';

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export function useSseStream({
  path,
  eventName,
  onMessage,
  paused = false,
  enabled = true,
}: UseSseStreamOptions): { status: Status } {
  const [status, setStatus] = useState<Status>('connecting');
  const onMessageRef = useRef(onMessage);
  const pausedRef = useRef(paused);
  onMessageRef.current = onMessage;
  pausedRef.current = paused;

  useEffect(() => {
    if (!enabled) {
      setStatus('closed');
      return;
    }
    let cancelled = false;
    let controller: AbortController | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      const token = getAuthToken();
      if (!token) {
        setStatus('error');
        return;
      }
      const url = `${API_BASE_URL}${path}`;

      setStatus('connecting');
      controller = new AbortController();
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
        setStatus('open');
        backoffMs = INITIAL_BACKOFF_MS;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const lines = block.split('\n');
            const type = lines
              .find((line) => line.startsWith('event:'))
              ?.slice(6)
              .trim();
            const data = lines
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');
            if ((!type || type === eventName) && data && !pausedRef.current) {
              onMessageRef.current(data);
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
        if (!cancelled) throw new Error('SSE stream closed');
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setStatus('error');
        const wait = Math.min(backoffMs, MAX_BACKOFF_MS);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        retryTimer = setTimeout(() => void connect(), wait);
      }
    };

    void connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      setStatus('closed');
    };
  }, [path, eventName, enabled]);

  return { status };
}
