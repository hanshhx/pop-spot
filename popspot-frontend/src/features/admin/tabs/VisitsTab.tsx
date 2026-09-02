import type { AdminReferrer, AdminTodayPath, AdminVisitStats } from '@/features/admin/types';
import { CampaignsPanel } from '@/features/admin/CampaignsPanel';
import { PopupOpensPanel } from '@/features/admin/PopupOpensPanel';
import {
  completedAverage,
  completedDays,
  lastCompletedDay,
  SHORTFALL_ALERT,
} from '@/features/admin/visitWindows';
import { checkGap } from '@/features/admin/visitGap';

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

      {/* 둘 다 스스로 불러온다 — 기간을 자기가 관리하므로 부모를 거치면 상태가 두 곳에 나뉜다. */}
      <PopupOpensPanel />
      <CampaignsPanel />
      <CollectionGapBanner
        lastVisitAt={visitStats.lastVisitAt}
        hourlyAverage={visitStats.hourlyAverage}
      />

      <CompletedDaySummary daily={visitStats.daily} />

      {/*
        오늘 숫자는 아래로 내리고 '진행 중' 을 붙인다. 예전에는 타일 다섯 중 넷이 '오늘' 이라,
        비교에 쓰면 안 되는 숫자만 크게 보였다 — 급할 때는 반드시 큰 쪽을 집게 된다.
      */}
      <div>
        <p className="mb-2 text-xs font-bold text-muted-foreground">
          오늘 <span className="font-normal">— 진행 중이라 비교에 쓸 수 없습니다</span>
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '방문자', value: visitStats.todayVisitors, sub: '고유' },
            { label: '페이지뷰', value: visitStats.todayPageviews, sub: '' },
            { label: '게스트', value: visitStats.todayGuests, sub: '' },
            { label: '회원', value: visitStats.todayMembers, sub: '' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-dashed border-[var(--color-border)] bg-surface/60 p-4"
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-bold text-muted-foreground md:text-2xl">
                {s.value.toLocaleString()}
                {s.sub && <span className="ml-1 text-xs font-normal">{s.sub}</span>}
              </p>
            </div>
          ))}
        </div>
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

/**
 * <b>Vercel 과 맞춰 볼 숫자.</b> 완료된 날만 쓴다.
 *
 * <p>진행 중인 오늘이 섞이면 언제나 낮게 나오고, 그 낮은 숫자를 하락으로 읽게 된다 — 2026-09-02
 * 에 실제로 그렇게 "−47% 급락" 이라 판단했다가 완료된 주끼리 놓고 −6.8% 로 정정했다.
 */
function CompletedDaySummary({ daily }: { daily: AdminVisitStats['daily'] }) {
  const last = lastCompletedDay(daily);
  const average = completedAverage(daily);
  const doneCount = completedDays(daily).length;

  return (
    <div className="rounded-2xl border border-lime-400/50 bg-lime-50/60 p-4 dark:bg-lime-400/5">
      <p className="text-xs font-bold text-lime-700 dark:text-lime-300">
        Vercel 과 맞춰 볼 숫자 — 완료된 날만
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {last ? `${last.date} (완료)` : '완료된 날 없음'}
          </p>
          <p className="mt-1 text-2xl font-black md:text-3xl">
            {last ? last.visitors.toLocaleString() : '—'}
            <span className="ml-1 text-xs font-normal text-muted-foreground">고유</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">완료 {doneCount}일 평균</p>
          <p className="mt-1 text-2xl font-black md:text-3xl">
            {average === null ? '—' : Math.round(average).toLocaleString()}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/일</span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Vercel 대시보드에서 <b>같은 날</b>을 열어 비교합니다. 차이가 ±
        {Math.round(SHORTFALL_ALERT * 100)}% 를 넘으면 우리 수집이 새고 있는 것이니, 방문 기록의
        공백부터 확인하세요.
      </p>
    </div>
  );
}

/**
 * <b>수집이 멎었을 때만</b> 뜨는 띠.
 *
 * <p>2026-08-13~19 에 방문 기록이 통째로 비었는데 아무 신호가 없었다. 그 구간을 나중에 보고
 * "유입이 줄었네" 하고 엉뚱한 곳을 의심하게 된다.
 *
 * <p>판정은 {@link checkGap} 이 한다 — 고정 시간이 아니라 <b>그 구간의 평소치</b>와 견주므로,
 * 새벽의 자연스러운 공백에는 조용하고 낮에 멎으면 운다. 근거가 없으면(백엔드가 아직 이 값을
 * 안 줄 때) 아무것도 그리지 않는다.
 */
function CollectionGapBanner({
  lastVisitAt,
  hourlyAverage,
}: Pick<AdminVisitStats, 'lastVisitAt' | 'hourlyAverage'>) {
  const gap = checkGap(lastVisitAt, hourlyAverage);
  if (!gap.alarming || gap.gapMinutes === null) return null;

  const hours = Math.floor(gap.gapMinutes / 60);
  const minutes = Math.round(gap.gapMinutes % 60);
  const 경과 = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-400/60 bg-red-50 p-4 dark:bg-red-500/10"
    >
      <p className="text-sm font-bold text-red-700 dark:text-red-300">
        방문 기록이 {경과}째 없습니다
      </p>
      <p className="mt-1 text-xs leading-relaxed text-red-700/80 dark:text-red-300/80">
        이 시간대라면 {Math.round(gap.expected ?? 0)}건쯤 들어왔어야 합니다. 수집이 멎었는지
        확인하세요 — 백엔드가 살아 있는지, 비콘이 실패하고 있는지 순서로 봅니다.
      </p>
    </div>
  );
}
