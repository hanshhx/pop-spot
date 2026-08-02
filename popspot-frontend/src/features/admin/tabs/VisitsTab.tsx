import type { AdminReferrer, AdminTodayPath, AdminVisitStats } from '@/features/admin/types';

type VisitsTabProps = {
  visitStats: AdminVisitStats;
  todayPaths: AdminTodayPath[];
  referrers: AdminReferrer[];
  loadVisitStats: () => void;
};

export function VisitsTab({ visitStats, todayPaths, referrers, loadVisitStats }: VisitsTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <p className="text-sm text-muted-foreground">익명 집계 · IP 미저장</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '오늘 방문자', value: visitStats.todayVisitors, sub: '고유' },
          { label: '오늘 페이지뷰', value: visitStats.todayPageviews, sub: '' },
          { label: '오늘 게스트', value: visitStats.todayGuests, sub: '' },
          { label: '오늘 회원', value: visitStats.todayMembers, sub: '' },
          { label: '7일 방문자', value: visitStats.weekVisitors, sub: '고유' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-surface p-4 rounded-2xl border border-[var(--color-border)]"
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl md:text-3xl font-black mt-1">
              {s.value.toLocaleString()}
              {s.sub && (
                <span className="text-xs font-normal text-muted-foreground ml-1">{s.sub}</span>
              )}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 유입 경로 — "어디서 제일 많이 오나" 에 바로 답하는 표라 맨 위·전체 폭. */}
        <div className="bg-surface p-5 rounded-2xl border border-[var(--color-border)] lg:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-sm">
              유입 경로 (7일){' '}
              <span className="text-muted-foreground font-normal">(사이트 내 이동 제외)</span>
            </h3>
            <button
              onClick={loadVisitStats}
              className="rounded-pill border border-[var(--color-border)] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              새로고침
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            방문 직전에 있던 곳입니다. <b>직접 방문</b>은 주소 입력·북마크·앱에서 열기라 출처를 알
            수 없는 경우입니다. 비중은 아래 목록 합계 기준.
          </p>
          {referrers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              아직 수집된 유입 경로가 없습니다.
              <span className="mt-1 block text-xs">
                (백엔드 배포 후 새로 들어오는 방문부터 집계됩니다)
              </span>
            </p>
          ) : (
            <ul className="space-y-1">
              {(() => {
                // 0 나누기 방지 — 목록이 비어있지 않으면 합계는 1 이상이지만 방어적으로.
                const total = referrers.reduce((sum, r) => sum + r.visits, 0) || 1;
                return referrers.map((r) => (
                  <li
                    key={`${r.source}:${r.host}`}
                    className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] last:border-0 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-bold">{r.source}</span>
                      {/* 실제 도메인일 때만 병기 — direct 같은 분류값은 source 로 이미 보인다. */}
                      {r.host?.includes('.') && r.host !== r.source && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {r.host}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs">
                      <span className="font-bold">{r.visits.toLocaleString()}</span>
                      <span className="rounded-full bg-lime-300/20 px-2 py-0.5 font-bold text-lime-700 dark:text-lime-300">
                        {((r.visits / total) * 100).toFixed(1)}%
                      </span>
                    </span>
                  </li>
                ));
              })()}
            </ul>
          )}
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-[var(--color-border)]">
          <h3 className="font-bold text-sm mb-4">최근 7일 방문자</h3>
          {visitStats.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">데이터가 아직 없어요.</p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-40">
              {(() => {
                const max = Math.max(...visitStats.daily.map((x) => x.visitors), 1);
                return visitStats.daily.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                  >
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {d.visitors}
                    </span>
                    <div
                      className="w-full bg-lime-300 rounded-t-md"
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
        <div className="bg-surface p-5 rounded-2xl border border-[var(--color-border)]">
          <h3 className="font-bold text-sm mb-4">인기 페이지 (7일)</h3>
          {visitStats.topPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">데이터가 아직 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {visitStats.topPaths.map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-muted-foreground font-mono text-xs">{p.path}</span>
                  <span className="font-bold shrink-0">{p.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-[var(--color-border)] lg:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-sm">
              오늘 방문 경로{' '}
              <span className="text-muted-foreground font-normal">
                (봇 제외 · 회원/게스트 구분)
              </span>
            </h3>
            <button
              onClick={loadVisitStats}
              className="rounded-pill border border-[var(--color-border)] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              새로고침
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            /login·/admin·/oauth에 <b>회원</b> 뷰가 많으면 본인 접속, /popups·/popup에 <b>게스트</b>
            가 많으면 외부·검색 유입입니다.
          </p>
          {todayPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              오늘 방문이 아직 없어요.
            </p>
          ) : (
            <ul className="space-y-1">
              {todayPaths.map((p) => (
                <li
                  key={p.path}
                  className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] last:border-0 py-1.5 text-sm"
                >
                  <span className="truncate font-mono text-xs text-muted-foreground">{p.path}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs">
                    <span className="font-bold">{p.total}</span>
                    {p.members > 0 && (
                      <span className="rounded-full bg-lime-300/20 px-2 py-0.5 font-bold text-lime-700 dark:text-lime-300">
                        회원 {p.members}
                      </span>
                    )}
                    {p.guests > 0 && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-muted-foreground dark:bg-white/10">
                        게스트 {p.guests}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
