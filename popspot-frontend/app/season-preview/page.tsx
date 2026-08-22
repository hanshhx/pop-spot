import type { Metadata } from 'next';

import { Logo } from '@/components/layout/Logo';
import { SeasonMark } from '@/components/layout/SeasonMark';
import { SEASONS, SEASON_LABEL, SEASON_MONTHS, seasonOf, solarTermOf } from '@/lib/season';

/**
 * 계절 테마 확인용 화면. <b>서비스 화면이 아니다.</b>
 *
 * <p>계절은 1년에 네 번만 바뀌므로 실제 화면에서는 지금 계절 하나밖에 볼 수 없다. 넷을 나란히
 * 놓고 봐야 "겨울만 유난히 튀는지" 같은 것이 보인다. 라이트·다크도 같이 놓는다 — 다크는
 * 라이트에서 계산해 만들 수 없어서, 둘을 따로 보지 않으면 한쪽이 조용히 어긋난다.
 */
export const metadata: Metadata = {
  title: '계절 테마 미리보기',
  robots: { index: false, follow: false },
};

/** 실제 화면의 한 조각을 흉내 낸 카드. 토큰이 어떻게 보이는지는 이런 덩어리로 봐야 안다. */
function SampleCard() {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold" style={{ color: 'var(--color-foreground)' }}>
          성수 팝업스토어
        </p>
        {/* 계절이 실제로 보이는 자리 — 만채도, 좁은 면적. */}
        <span className="season-signal shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold">
          D-2
        </span>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
        서울 성동구 연무장길
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-subtle-foreground)' }}>
        8월 24일 마감
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="rounded-pill bg-lime-300 px-2.5 py-1 text-[11px] font-bold text-ink-900">
          지도 보기
        </span>
        <span className="season-signal-text text-[11px] font-black">42곳</span>
      </div>
    </div>
  );
}

function SeasonColumn({ season }: { season: (typeof SEASONS)[number] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <SeasonMark season={season} className="size-4 shrink-0" />
        <p className="text-xs font-bold">
          {SEASON_LABEL[season].ko}
          <span className="ml-1 font-normal text-subtle-foreground">
            {SEASON_MONTHS[season].join('·')}월
          </span>
        </p>
      </div>
      {(['light', 'dark'] as const).map((mode) => (
        <div
          key={mode}
          data-season={season}
          className={`mb-2 rounded-2xl border p-3 ${mode === 'dark' ? 'dark' : ''}`}
          style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)' }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-subtle-foreground">
            {mode}
          </p>
          <SampleCard />
        </div>
      ))}
    </div>
  );
}

export default function SeasonPreviewPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          popspot
        </p>
        <h1 className="mt-1 text-3xl font-black">계절 테마 미리보기</h1>
        <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
          계절이 바꾸는 것은 배경의 색온도(라이트 4~6% · 다크 2~3%)와 <strong>신호 색</strong>
          입니다. 신호는 D-day 배지·건수처럼 좁은 자리에만 들어갑니다 — 화면 전체를 옅게 물들이는
          방식은 아무도 알아채지 못합니다.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-pill bg-black/[0.05] px-3 py-1.5 text-sm font-bold dark:bg-white/10">
          오늘 · {SEASON_LABEL[seasonOf()].ko} · {solarTermOf()} 무렵
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SEASONS.map((season) => (
          <SeasonColumn key={season} season={season} />
        ))}
      </div>

      <p className="mt-4 max-w-[62ch] text-xs text-muted-foreground">
        라임 버튼은 사계절 그대로입니다 — 라임은 &ldquo;지금 누를 것&rdquo; 이라는 뜻이라
        계절이 건드리지 않습니다. 계절이 말하는 자리는 D-day 배지와 건수 숫자입니다.
      </p>
    </main>
  );
}
