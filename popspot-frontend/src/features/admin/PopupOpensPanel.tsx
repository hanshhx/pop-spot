'use client';

import { useCallback, useEffect, useState } from 'react';
import { MousePointerClick, RefreshCw } from 'lucide-react';

import { apiFetch } from '@/lib/api';

/**
 * 많이 열린 팝업 — 목록에서 카드를 눌러 상세를 연 횟수.
 *
 * <p>페이지뷰와 다르다. 페이지뷰는 "상세 화면이 몇 번 열렸나" 라 링크를 직접 받아 들어온 것도 포함되는데,
 * 이 값은 <b>우리 목록에서 눌린</b> 것만 센다. 어떤 팝업을 앞에 놓을지 판단하는 데 쓰인다.
 */

type PopupOpen = {
  popupId: number;
  name: string | null;
  opens: number;
  visitors: number;
};

const RANGES = [
  { days: 7, label: '일주일' },
  { days: 30, label: '한 달' },
] as const;

export function PopupOpensPanel() {
  const [rows, setRows] = useState<PopupOpen[]>([]);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/visits/popup-opens?days=${days}&limit=20`);
      if (res.ok) setRows((await res.json()) as PopupOpen[]);
    } catch {
      /* 통계를 못 불러와도 화면은 떠 있어야 한다 */
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const max = rows.length > 0 ? rows[0].opens : 1;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <MousePointerClick size={16} className="text-lime-500" aria-hidden /> 많이 열린 팝업
        </h3>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-[var(--color-border)]">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={`px-3 py-1 text-xs font-bold transition-colors ${
                  days === r.days
                    ? 'bg-foreground text-[var(--color-surface)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="새로고침"
            className="rounded-full border border-[var(--color-border)] p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        목록에서 카드를 눌러 상세를 연 횟수입니다. 링크를 직접 받아 들어온 것은 포함되지 않습니다.
      </p>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {loading ? '불러오는 중…' : '아직 기록이 없어요. (배포 후 클릭부터 쌓입니다)'}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.popupId} className="flex items-center gap-3 text-sm">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate" title={r.name ?? undefined}>
                {/* 팝업이 지워졌으면 이름이 없다. 기록 자체는 남아 있으므로 id 로라도 보여 준다. */}
                {r.name ?? `#${r.popupId} (삭제됨)`}
              </span>
              {/* 막대는 1등 대비 비율. 숫자만 있으면 격차가 눈에 안 들어온다. */}
              <span className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-foreground/10 sm:block">
                <span
                  className="block h-full rounded-full bg-lime-400"
                  style={{ width: `${Math.max(4, (r.opens / max) * 100)}%` }}
                />
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums">{r.opens}회</span>
              {/* 같은 사람이 스무 번 들락거린 것과 스무 명이 한 번씩 본 것은 다른 이야기다. */}
              <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {r.visitors}명
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
