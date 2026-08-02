import { Activity, Cpu, Database, Globe } from 'lucide-react';
import { LogViewer } from '@/components/admin/log/LogViewer';
import { MetricCard } from '@/components/admin/metrics/MetricCard';
import type { DashboardMetrics, MetricData } from '@/features/admin/types';

type SystemTabProps = {
  dashboard: DashboardMetrics;
  realtimeMetrics: MetricData[];
  cpuNow: number;
  memNow: number;
  serverStatus: 'online' | 'offline';
};

export function SystemTab({
  dashboard,
  realtimeMetrics,
  cpuNow,
  memNow,
  serverStatus,
}: SystemTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          label="JVM Heap"
          value={Math.round(Number(dashboard.snapshot?.jvm?.heapUsedMb ?? 0))}
          unit="MB"
          sub={`최대 ${Math.round(Number(dashboard.snapshot?.jvm?.heapMaxMb ?? 0))}MB · Thread ${dashboard.snapshot?.jvm?.threadsLive ?? 0}`}
          icon={<Cpu size={24} />}
          tone={
            Number(dashboard.snapshot?.jvm?.heapUsedMb ?? 0) /
              Math.max(1, Number(dashboard.snapshot?.jvm?.heapMaxMb ?? 1)) >
            0.85
              ? 'danger'
              : 'ok'
          }
        />
        <MetricCard
          label="HTTP 요청"
          value={dashboard.snapshot?.http?.requestCount ?? 0}
          unit="건"
          sub={`p95 ${Number(dashboard.snapshot?.http?.p95Ms ?? 0).toFixed(0)}ms · 5xx ${dashboard.snapshot?.http?.status5xxCount ?? 0}`}
          icon={<Globe size={24} />}
          tone={Number(dashboard.snapshot?.http?.errorRate ?? 0) > 0.05 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="DB Pool"
          value={dashboard.snapshot?.db?.active ?? 0}
          unit="active"
          sub={`idle ${dashboard.snapshot?.db?.idle ?? 0} · pending ${dashboard.snapshot?.db?.pending ?? 0} / max ${dashboard.snapshot?.db?.max ?? 0}`}
          icon={<Database size={24} />}
          tone={Number(dashboard.snapshot?.db?.pending ?? 0) > 0 ? 'warning' : 'ok'}
        />
        <MetricCard
          label="오늘 자동수집"
          value={dashboard.snapshot?.crawler?.crawledToday ?? 0}
          unit="건"
          sub={`평균 신뢰도 ${dashboard.snapshot?.crawler?.avgConfidence ?? 0} · 검수 대기 ${dashboard.snapshot?.crawler?.pendingReview ?? 0}`}
          icon={<Activity size={24} />}
        />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Cpu size={16} className="text-lime-500" /> GCP 서버 실시간 리소스
          </h3>
          <div className="flex gap-3 text-xs font-mono">
            <span className="text-lime-600 dark:text-lime-400 font-bold">CPU {cpuNow}%</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">MEM {memNow}MB</span>
            <span
              className={`flex items-center gap-1 ${serverStatus === 'online' ? 'text-green-600' : 'text-red-500'}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
              />
              {serverStatus === 'online' ? '정상' : '오프라인'}
            </span>
          </div>
        </div>
        <div className="h-48 flex items-end justify-between gap-1.5">
          {realtimeMetrics.length === 0 ? (
            <p className="w-full text-center text-sm text-muted-foreground py-16">
              실시간 데이터를 기다리는 중…
            </p>
          ) : (
            (() => {
              const maxMem = Math.max(...realtimeMetrics.map((m) => m.memory), 1);
              return realtimeMetrics.map((m, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                  title={`${m.time} · CPU ${m.cpu}% · MEM ${m.memory}MB`}
                >
                  <div
                    className="w-full bg-lime-300 rounded-t-sm"
                    style={{ height: `${(m.memory / maxMem) * 100}%`, minHeight: 2 }}
                  />
                </div>
              ));
            })()
          )}
        </div>
      </div>

      <div>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Activity size={16} className="text-lime-500" /> 실시간 로그
        </h3>
        <LogViewer active={true} />
      </div>
    </div>
  );
}
