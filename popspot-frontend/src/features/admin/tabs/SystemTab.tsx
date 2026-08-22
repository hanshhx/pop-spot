import { Activity, AlertTriangle, Cpu, Database, Globe, ShieldAlert } from 'lucide-react';
import { LogViewer } from '@/components/admin/log/LogViewer';
import { MetricCard } from '@/components/admin/metrics/MetricCard';
import { TotpSetupPanel } from '@/features/admin/TotpSetupPanel';
import { SeasonThemePanel } from '@/features/admin/SeasonThemePanel';
import type { DashboardMetrics, MetricData, ServerResource } from '@/features/admin/types';

type SystemTabProps = {
  dashboard: DashboardMetrics;
  realtimeMetrics: MetricData[];
  serverResource: ServerResource | null;
  cpuNow: number;
  memNow: number;
  serverStatus: 'online' | 'offline';
  onRevokeAllSessions: () => void;
};

/** `1.2 / 8.0 GB` 처럼. 총량을 모르면 사용량만 보여 준다 — 0 을 총량으로 쓰면 100% 로 보인다. */
function usage(used: number, total: number, unit: string): string {
  const u = used >= 100 ? Math.round(used) : Number(used.toFixed(1));
  if (!total) return `${u}${unit}`;
  const t = total >= 100 ? Math.round(total) : Number(total.toFixed(1));
  return `${u} / ${t}${unit}`;
}

export function SystemTab({
  dashboard,
  realtimeMetrics,
  serverResource,
  cpuNow,
  memNow,
  serverStatus,
  onRevokeAllSessions,
}: SystemTabProps) {
  const crawler = dashboard.snapshot?.crawler;
  const automationDisabled = Boolean(dashboard.snapshot && crawler?.automationEnabled === false);
  const popupDataStale = Boolean(
    dashboard.snapshot && crawler?.automationEnabled === true && crawler?.newPopupDataStale,
  );
  const memPercent = serverResource?.memoryTotalMb
    ? (serverResource.memoryUsedMb / serverResource.memoryTotalMb) * 100
    : 0;
  const diskPercent = serverResource?.diskTotalGb
    ? (serverResource.diskUsedGb / serverResource.diskTotalGb) * 100
    : 0;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SeasonThemePanel />
      {automationDisabled && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-bold text-red-700 dark:text-red-300">
            <AlertTriangle size={17} /> 자동 갱신이 꺼져 있습니다
          </p>
          <p className="mt-1 text-muted-foreground">
            예약 작업 {crawler?.schedulingEnabled ? '켜짐' : '꺼짐'} · 자동수집{' '}
            {crawler?.crawlerEnabled ? '켜짐' : '꺼짐'}. 서버 복구 뒤 이 상태가 남으면 새 팝업과
            만료 처리가 갱신되지 않습니다.
          </p>
        </div>
      )}

      {popupDataStale && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
            <AlertTriangle size={17} /> 새 자동수집 데이터가 36시간 넘게 없습니다
          </p>
          <p className="mt-1 text-muted-foreground">
            새 팝업이 없었던 것일 수도 있습니다. 마지막 신규 저장{' '}
            <b className="text-foreground">{crawler?.lastNewPopupAt ?? '기록 없음'}</b> · 크롤 실행
            로그와 API 키 상태를 함께 확인하세요.
          </p>
        </div>
      )}

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
            <Cpu size={16} className="text-lime-500" /> 운영 서버 실시간 리소스
          </h3>
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            <span className="text-lime-600 dark:text-lime-400 font-bold">CPU {cpuNow}%</span>
            {/*
              v2.53 — 예전에는 여기 JVM 힙이 "MEM" 으로 떠 있었다. 서버에 8GB 가 있어도 자바가 쓰는
              몇백 MB 만 보여서, 서버가 실제로 여유가 있는지 알 수 없었다. 이제 OS 물리 메모리다.
            */}
            <span
              className={`font-bold ${memPercent > 85 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}
              title="운영 서버의 물리 메모리"
            >
              MEM{' '}
              {serverResource
                ? usage(
                    serverResource.memoryUsedMb / 1024,
                    serverResource.memoryTotalMb / 1024,
                    'GB',
                  )
                : `${memNow}MB`}
              {memPercent > 0 && ` (${Math.round(memPercent)}%)`}
            </span>
            <span
              className={`font-bold ${diskPercent > 85 ? 'text-red-500' : 'text-sky-600 dark:text-sky-400'}`}
              title="업로드가 쌓이는 파일시스템"
            >
              DISK{' '}
              {serverResource
                ? usage(serverResource.diskUsedGb, serverResource.diskTotalGb, 'GB')
                : '—'}
              {diskPercent > 0 && ` (${Math.round(diskPercent)}%)`}
            </span>
            <span className="text-muted-foreground" title="JVM 힙 — 서버 메모리와 다르다">
              HEAP{' '}
              {serverResource
                ? usage(serverResource.heapUsedMb, serverResource.heapMaxMb, 'MB')
                : '—'}
            </span>
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
              // 막대 높이는 구간 내 최댓값 기준이라, 값의 절대 크기가 바뀌어도(힙 MB → 서버 MB)
              // 그래프 모양은 그대로 읽힌다. 총량 대비 비율은 위의 MEM 숫자가 알려 준다.
              const maxMem = Math.max(...realtimeMetrics.map((m) => m.memory), 1);
              return realtimeMetrics.map((m, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                  title={`${m.time} · CPU ${m.cpu}% · 서버 메모리 ${(m.memory / 1024).toFixed(1)}GB`}
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

      <TotpSetupPanel />

      {/*
        토큰이 샜다고 의심될 때 쓰는 비상 스위치. 아래에 두는 이유는 실수로 누를 자리가 아니기
        때문이다 — 누르면 지금 이 창도 로그아웃된다.
      */}
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <h3 className="font-bold text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
          <ShieldAlert size={16} /> 계정 보안
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          관리자 토큰이 샜다고 의심되면 모든 기기에서 한 번에 로그아웃할 수 있습니다.{' '}
          <b className="text-foreground">지금 보고 있는 이 창도 함께 로그아웃됩니다.</b>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          이미 열려 있는 실시간 로그 연결은 그 연결이 끊길 때까지 유지됩니다.
        </p>
        <button
          onClick={onRevokeAllSessions}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
        >
          모든 기기에서 로그아웃
        </button>
      </div>
    </div>
  );
}
