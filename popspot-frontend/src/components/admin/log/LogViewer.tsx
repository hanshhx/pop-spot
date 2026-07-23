'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pause, Play, Trash2 } from 'lucide-react';

import { useSseStream } from './useSseStream';

const MAX_LINES = 500;
const SSE_PATH = '/api/admin/logs/stream';
const SSE_EVENT_NAME = 'log';

/**
 * 어드민 실시간 로그 뷰어.
 *
 * - SSE 로 새 라인을 받아 최근 {@link MAX_LINES} 줄만 유지.
 * - 정규식 필터 / 일시정지 / 비우기 / 다운로드 / 자동 스크롤 토글.
 * - 라인의 로그 레벨 (INFO/WARN/ERROR) 을 색으로 구분.
 */
export function LogViewer({ active }: { active: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLPreElement>(null);

  const { status } = useSseStream({
    path: SSE_PATH,
    eventName: SSE_EVENT_NAME,
    paused,
    enabled: active,
    onMessage: (line) => {
      setLines((prev) => {
        const next = [...prev, line];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    },
  });

  // 필터링 — 빈 필터면 그대로, 정규식 실패 시 substring 폴백.
  const filtered = useMemo(() => {
    if (!filter.trim()) return lines;
    try {
      const re = new RegExp(filter, 'i');
      return lines.filter((l) => re.test(l));
    } catch {
      return lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()));
    }
  }, [lines, filter]);

  // 새 라인 들어오면 자동 스크롤.
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filtered, autoScroll]);

  const handleDownload = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popspot-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-ink-700 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 dark:border-white/5">
        <input
          type="text"
          placeholder="정규식 / 부분문자열 필터"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[200px] bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 ring-lime-300/50"
        />
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
            paused
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15'
          }`}
          aria-label={paused ? '재개' : '일시정지'}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? '재개' : '일시정지'}
        </button>
        <label className="text-xs flex items-center gap-1.5 px-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          자동 스크롤
        </label>
        <button
          type="button"
          onClick={() => setLines([])}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 inline-flex items-center gap-1.5"
          aria-label="화면 비우기"
        >
          <Trash2 size={12} />
          비우기
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-lime-300 text-ink-900 hover:bg-lime-400 inline-flex items-center gap-1.5"
          aria-label="다운로드"
        >
          <Download size={12} />
          다운로드
        </button>
        <ConnectionBadge status={status} />
      </div>

      <pre
        ref={scrollRef}
        className="h-[60vh] overflow-y-auto bg-black/95 text-gray-200 p-4 text-[12px] font-mono leading-relaxed whitespace-pre-wrap"
      >
        {filtered.length === 0 ? (
          <span className="text-gray-500">
            로그 대기 중... 백엔드에서 logging.file.name 환경변수가 설정돼야 표시됩니다.
          </span>
        ) : (
          filtered.map((line, i) => (
            <div key={i} className={lineColor(line)}>
              {line}
            </div>
          ))
        )}
      </pre>
    </div>
  );
}

function ConnectionBadge({ status }: { status: 'connecting' | 'open' | 'closed' | 'error' }) {
  const map = {
    connecting: { text: '연결 중', color: 'bg-gray-400' },
    open: { text: '연결됨', color: 'bg-green-500 animate-pulse' },
    closed: { text: '닫힘', color: 'bg-gray-500' },
    error: { text: '재연결', color: 'bg-red-500' },
  } as const;
  const { text, color } = map[status];
  return (
    <span className="text-[11px] text-gray-500 inline-flex items-center gap-1.5 ml-auto">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {text}
    </span>
  );
}

/** 라인 안에 어떤 로그 레벨이 나오는지 보고 색 결정. */
function lineColor(line: string): string {
  if (/\bERROR\b/.test(line)) return 'text-red-400';
  if (/\bWARN\b/.test(line)) return 'text-amber-300';
  if (/\bINFO\b/.test(line)) return 'text-gray-200';
  if (/\bDEBUG\b/.test(line)) return 'text-gray-400';
  return 'text-gray-300';
}
