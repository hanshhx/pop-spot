import { AlertCircle, ChevronRight, Cpu, MapPin, MessageSquare, Store, Users } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import type { PopupStore } from '@/types/popup';
import type { AdminStats, AdminVisitStats, DashboardMetrics } from '@/features/admin/types';

type DashboardTabProps = {
  stats: AdminStats | null;
  visitStats: AdminVisitStats | null;
  pendingPopups: PopupStore[];
  dashboard: DashboardMetrics;
  cpuNow: number;
  memNow: number;
  dbActive: number;
  serverStatus: 'online' | 'offline';
  setActiveTab: (tab: string) => void;
};

export function DashboardTab({
  stats,
  visitStats,
  pendingPopups,
  dashboard,
  cpuNow,
  memNow,
  dbActive,
  serverStatus,
  setActiveTab,
}: DashboardTabProps) {
  const automationDisabled = Boolean(
    dashboard.snapshot && dashboard.snapshot.crawler?.automationEnabled === false,
  );
  return (
    <div className="space-y-5 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 서비스 지표 4카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="가입 유저"
          value={stats?.totalUsers ?? 0}
          sub="전체 회원"
          icon={<Users size={18} />}
          tone="lime"
        />
        <StatCard
          label="운영중 팝업"
          value={stats?.activePopups ?? 0}
          sub={
            dashboard.snapshot?.crawler?.crawledToday
              ? `오늘 +${dashboard.snapshot.crawler.crawledToday} 수집`
              : '실시간 운영중'
          }
          icon={<Store size={18} />}
          tone="green"
        />
        <StatCard
          label="승인 대기"
          value={stats?.pendingPopups ?? 0}
          sub="확인 필요"
          icon={<AlertCircle size={18} />}
          tone="amber"
        />
        <StatCard
          label="동행 게시글"
          value={stats?.totalMatePosts ?? 0}
          sub="커뮤니티"
          icon={<MessageSquare size={18} />}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 최근 7일 방문 */}
        <div className="lg:col-span-3 rounded-2xl border border-[var(--color-border)] bg-surface p-5">
          <h3 className="font-bold text-sm mb-4">최근 7일 방문</h3>
          {!visitStats || visitStats.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">데이터가 아직 없어요.</p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-44">
              {(() => {
                const max = Math.max(...visitStats.daily.map((x) => x.visitors), 1);
                return visitStats.daily.map((d, i) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full"
                  >
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {d.visitors}
                    </span>
                    <div
                      className={`w-full rounded-t-md ${i === visitStats.daily.length - 1 ? 'bg-lime-500' : 'bg-lime-300'}`}
                      style={{
                        height: `${(d.visitors / max) * 100}%`,
                        minHeight: d.visitors > 0 ? 4 : 0,
                      }}
                    />
                    <span className="text-[9px] text-muted-foreground">{d.date}</span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* 제보 승인 대기 */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <AlertCircle size={15} className="text-amber-500" /> 제보 승인 대기{' '}
              {pendingPopups.length}
            </h3>
            {pendingPopups.length > 3 && (
              <button
                onClick={() => setActiveTab('PENDING')}
                className="text-[11px] font-bold text-lime-600 dark:text-lime-300 hover:underline flex items-center gap-0.5"
              >
                전체 <ChevronRight size={12} />
              </button>
            )}
          </div>
          {pendingPopups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              대기 중인 제보가 없어요.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {pendingPopups.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-0.5">
                      <MapPin size={10} /> {p.location}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('PENDING')}
                    className="shrink-0 rounded-lg bg-lime-300 px-2.5 py-1.5 text-[11px] font-bold text-ink-900 hover:bg-lime-400 transition-colors"
                  >
                    검수하기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 하단 시스템 상태 스트립 — 서버 지표는 상단이 아닌 여기로 강등 */}
      <button
        onClick={() => setActiveTab('SYSTEM')}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[var(--color-border)] bg-cream-100 dark:bg-ink-800/60 px-4 py-3 text-left text-xs text-muted-foreground transition-colors hover:bg-foreground/5"
      >
        <span className="flex items-center gap-1.5 font-bold text-foreground">
          <Cpu size={13} className="text-lime-500" /> 시스템
        </span>
        <span>
          CPU <b className="text-foreground">{cpuNow}%</b>
        </span>
        <span>
          MEM <b className="text-foreground">{memNow}MB</b>
        </span>
        <span>
          DB <b className="text-foreground">{dbActive}</b> active
        </span>
        <span className="flex items-center gap-1">
          <span
            className={`h-1.5 w-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}
          />{' '}
          {serverStatus === 'online' ? '정상' : '오프라인'}
        </span>
        {automationDisabled && (
          <span className="font-bold text-red-600 dark:text-red-400">자동 갱신 꺼짐</span>
        )}
        <span className="ml-auto flex items-center gap-0.5 font-bold text-lime-600 dark:text-lime-300">
          자세히 <ChevronRight size={12} />
        </span>
      </button>
    </div>
  );
}
