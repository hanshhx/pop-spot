'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

/**
 * v2.21-S11 — Spotify 연결 상태 + 액션 (login URL fetch / disconnect).
 *
 * <p>백엔드 endpoint:
 *
 * <ul>
 *   <li>{@code GET /api/spotify/me} — 연결 상태 + isPremium
 *   <li>{@code GET /api/spotify/login} — Spotify 로그인 URL 받기 (사용자 redirect 용)
 *   <li>{@code POST /api/spotify/disconnect} — 토큰 즉시 삭제
 * </ul>
 */

export type SpotifyConnectionState = {
  connected: boolean;
  isPremium: boolean;
  spotifyUserId?: string;
  loading: boolean;
};

const INITIAL: SpotifyConnectionState = {
  connected: false,
  isPremium: false,
  loading: true,
};

export function useSpotifyAuth() {
  const [state, setState] = useState<SpotifyConnectionState>(INITIAL);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/spotify/me');
      if (!res.ok) {
        setState({ connected: false, isPremium: false, loading: false });
        return;
      }
      const data = (await res.json()) as {
        connected: boolean;
        isPremium?: boolean;
        spotifyUserId?: string;
      };
      setState({
        connected: !!data.connected,
        isPremium: !!data.isPremium,
        spotifyUserId: data.spotifyUserId,
        loading: false,
      });
    } catch {
      setState({ connected: false, isPremium: false, loading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Spotify 로그인 페이지로 사용자 redirect. */
  const startLogin = useCallback(async () => {
    const res = await apiFetch('/api/spotify/login');
    if (!res.ok) {
      throw new Error('Spotify 로그인 URL 요청 실패');
    }
    const data = (await res.json()) as { authorizationUrl?: string };
    if (!data.authorizationUrl) {
      throw new Error('로그인 URL 누락');
    }
    // top-level navigation — popup 보다 안정적 (Safari 차단 회피)
    window.location.assign(data.authorizationUrl);
  }, []);

  /** 토큰 즉시 삭제 (DB row 제거). */
  const disconnect = useCallback(async () => {
    await apiFetch('/api/spotify/disconnect', { method: 'POST' });
    await refresh();
  }, [refresh]);

  return { ...state, refresh, startLogin, disconnect };
}
