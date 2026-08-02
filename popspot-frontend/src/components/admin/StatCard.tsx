import type { ReactNode } from 'react';

/**
 * 대시보드 서비스 지표 카드. tone 으로 아이콘/값 강조색만 바꾼다.
 *
 * <p>v2.53 — app/admin/page.tsx 에서 분리했다. 마크업·클래스는 그대로다.
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  icon: ReactNode;
  tone: 'lime' | 'green' | 'amber' | 'violet';
}) {
  const toneCls: Record<string, string> = {
    lime: 'bg-lime-300/20 text-lime-600 dark:text-lime-300',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/25 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/25 dark:text-violet-400',
  };
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneCls[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-3xl font-black tracking-tight">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
