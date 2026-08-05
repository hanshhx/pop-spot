'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { uaLooksBot } from '@/features/admin/helpers';
import type { AdminVisitor } from '@/features/admin/types';
import { apiFetch } from '@/lib/api';
import { ExportButton } from '@/features/admin/ExportButton';
import { SessionSummary } from '@/features/admin/SessionSummary';

/**
 * 방문자 목록.
 *
 * <p>다녀간 경로를 다시 보여 준다. 한때 개수만 남겼는데 운영에서 실제로 쓰는 값이었다 — 봇인지 판단할 때도, 어디서 이탈하는지 볼 때도 경로가 필요하다.
 *
 * <p>기간은 서버가 보관하는 만큼(90일)까지 고를 수 있다. 페이지도 서버가 나눈다 — 100명을 한 번에 받아 오던 예전 방식으로는 그 위를 아예 볼 수 없었다.
 *
 * <p>데이터를 스스로 불러온다. 부모가 넘겨주던 방식이면 기간·페이지가 바뀔 때마다 부모를 거쳐야 해서, 이 화면의 상태가 두 곳에 나뉜다.
 */

const PAGE_SIZE = 50;

/** 고를 수 있는 기간. 방문 기록 보관 기간이 90일이라 그 위는 물어봐야 나올 것이 없다. */
const RANGES = [
  { days: 7, label: '일주일' },
  { days: 30, label: '한 달' },
  { days: 90, label: '3개월' },
] as const;

type VisitorPage = {
  content: AdminVisitor[];
  page: number;
  size: number;
  totalElements: number;
  days: number;
};

export function VisitorsTab() {
  const [rows, setRows] = useState<AdminVisitor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        days: String(days),
        page: String(page),
        size: String(PAGE_SIZE),
      });
      const res = await apiFetch(`/api/admin/visits/visitors?${params}`);
      if (!res.ok) {
        setError('방문자 목록을 불러오지 못했습니다.');
        return;
      }
      const data = (await res.json()) as VisitorPage;
      setRows(data.content ?? []);
      setTotal(data.totalElements ?? 0);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [days, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const guests = rows.filter((v) => v.guest).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4 duration-500">
      {/*
        표보다 위에 둔다. 목록은 "누가 왔나" 를 보여 주는데, 먼저 답해야 하는 질문은
        "온 사람이 다시 오나" 다. 기간은 아래 버튼이 고른 것을 그대로 받는다 — 따로 두면
        같은 화면에서 표와 요약이 다른 기간을 보여 준다.
      */}
      <SessionSummary days={days} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            봇 제외 · 최근 방문 순 · 전체 {total.toLocaleString()}명
          </p>
          <p className="mt-1 text-xs font-bold">
            이 페이지 — 게스트 <span className="text-muted-foreground">{guests}명</span> · 회원{' '}
            <span className="text-lime-600 dark:text-lime-300">{rows.length - guests}명</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 기간을 바꾸면 첫 페이지로 돌아간다. 3페이지를 보던 중에 기간을 좁히면
              그 페이지가 없어져 빈 화면이 뜬다. */}
          <div className="flex overflow-hidden rounded-full border border-[var(--color-border)]">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => {
                  setDays(r.days);
                  setPage(0);
                }}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  days === r.days
                    ? 'bg-foreground text-[var(--color-surface)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <ExportButton dataset="visitors" days={days} />

          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="새로고침"
            className="rounded-full border border-[var(--color-border)] p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {rows.length === 0 && !loading ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-12 text-center text-sm text-muted-foreground">
          이 기간에 방문자가 없어요.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface">
          {rows.map((v, i) => (
            <li key={v.visitorId || i} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${v.guest ? 'bg-gray-200 text-muted-foreground dark:bg-white/10' : 'bg-lime-300/20 text-lime-700 dark:text-lime-300'}`}
                >
                  {v.guest ? '게스트' : '회원'}
                </span>
                <span className="shrink-0 text-xs font-bold">{v.visits}회</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  경로 {v.pathCount}개
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-[11px] text-muted-foreground">
                  {(v.lastSeen ?? '').slice(5, 16)}
                </span>
              </div>

              {/* 다녀간 경로. 잘라내지 않고 줄바꿈으로 흘린다 — 자르면 정작 보려던 뒷부분이 사라진다. */}
              {v.paths && (
                <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {v.paths}
                </p>
              )}

              {v.userAgent && (
                <p
                  className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70"
                  title={v.userAgent}
                >
                  {uaLooksBot(v.userAgent) && (
                    <span className="mr-1 rounded bg-red-500/15 px-1 font-bold text-red-500">
                      봇?
                    </span>
                  )}
                  {v.userAgent}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1 disabled:opacity-30"
          >
            이전
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1 disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
