import { uaLooksBot } from '@/features/admin/helpers';
import type { AdminVisitor } from '@/features/admin/types';

type VisitorsTabProps = {
  visitors: AdminVisitor[];
  loadVisitors: () => void;
};

export function VisitorsTab({ visitors, loadVisitors }: VisitorsTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            최근 7일 방문자 · 봇 제외 · 최근 방문 순 (최대 100명)
          </p>
          <p className="mt-1 text-xs font-bold">
            게스트{' '}
            <span className="text-muted-foreground">
              {visitors.filter((v) => v.guest).length}명
            </span>{' '}
            · 회원{' '}
            <span className="text-lime-600 dark:text-lime-300">
              {visitors.filter((v) => !v.guest).length}명
            </span>
          </p>
        </div>
        <button
          onClick={loadVisitors}
          className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          새로고침
        </button>
      </div>
      {visitors.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-12 text-center text-sm text-muted-foreground">
          최근 방문자가 없어요.
          <span className="mt-1 block text-xs">(백엔드 배포 후 집계됩니다)</span>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface">
          {visitors.map((v, i) => (
            <li
              key={v.visitorId || i}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${v.guest ? 'bg-gray-200 text-muted-foreground dark:bg-white/10' : 'bg-lime-300/20 text-lime-700 dark:text-lime-300'}`}
              >
                {v.guest ? '게스트' : '회원'}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {v.pathCount}개 경로
              </span>
              <span className="shrink-0 text-xs font-bold">{v.visits}회</span>
              <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                {(v.lastSeen ?? '').slice(5, 16)}
              </span>
              {v.userAgent && (
                <span
                  className="w-full min-w-0 truncate font-mono text-[10px] text-muted-foreground/70"
                  title={v.userAgent}
                >
                  {uaLooksBot(v.userAgent) && (
                    <span className="mr-1 rounded bg-red-500/15 px-1 font-bold text-red-500">
                      봇?
                    </span>
                  )}
                  {v.userAgent}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
