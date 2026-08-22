import type { Metadata } from 'next';

import { Logo } from '@/components/layout/Logo';
import { SeasonMark } from '@/components/layout/SeasonMark';
import { SEASONS, SEASON_LABEL, SEASON_MONTHS, seasonOf, solarTermOf } from '@/lib/season';

/**
 * 계절 테마 확인용 화면. <b>서비스 화면이 아니다.</b>
 *
 * <p>계절은 1년에 네 번만 바뀌므로, 실제 화면에서는 지금 계절 하나밖에 볼 수 없다.
 * 넷을 나란히 놓고 봐야 "겨울만 유난히 튀는지" 같은 것이 보인다.
 *
 * <p>배경 조각은 실제 배경과 <b>같은 변수</b>({@code --home-flat-image})를 쓴다.
 * 따로 그리면 여기서 괜찮아 보이는 것이 실제 화면에서 다르게 나온다.
 */
export const metadata: Metadata = {
  title: '계절 테마 미리보기',
  // 서비스 페이지가 아니므로 검색에 넣지 않는다.
  robots: { index: false, follow: false },
};

export default function SeasonPreviewPage() {
  const today = seasonOf();
  const term = solarTermOf();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          popspot
        </p>
        <h1 className="mt-1 text-3xl font-black">계절 테마 미리보기</h1>
        <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
          계절은 기상청 기준(3개월 묶음)으로 정합니다. 절기는 곁들이는 말로만 씁니다 — 절기로
          계절을 정하면 5월 초에 배경이 갑자기 여름이 됩니다.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-pill bg-black/[0.05] px-3 py-1.5 text-sm font-bold dark:bg-white/10">
          오늘 · {SEASON_LABEL[today].ko} · {term} 무렵
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          로고
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEASONS.map((season) => (
            <div
              key={season}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2">
                <Logo className="h-8" />
                <SeasonMark season={season} className="size-5 shrink-0" />
              </div>
              <p className="mt-3 text-xs font-bold">
                {SEASON_LABEL[season].ko}
                <span className="ml-1.5 font-normal text-subtle-foreground">
                  {SEASON_MONTHS[season].join('·')}월
                </span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-[62ch] text-xs text-muted-foreground">
          장식은 로고 높이의 절반이 넘지 않습니다. 로고 경로 자체는 손대지 않아서, 계절을 끄면
          원래 로고가 그대로 남습니다. 봄의 분홍은 새 색이 아니라 심볼에 이미 있는 브랜드
          핑크입니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          배경
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEASONS.map((season) => (
            <div key={season} data-season={season}>
              <div className="season-swatch relative aspect-[9/16] max-h-[420px] overflow-hidden rounded-2xl border border-black/10 bg-cream-200 dark:border-white/10 dark:bg-ink-900">
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                  <span className="rounded-pill bg-black/[0.06] px-2.5 py-1 text-[11px] font-bold dark:bg-white/10">
                    {SEASON_LABEL[season].ko}
                  </span>
                  {/* 라임이 여전히 가장 강한 색인지 보려고 실제 버튼을 하나 놓는다. */}
                  <span className="rounded-pill bg-lime-300 px-2.5 py-1 text-[11px] font-bold text-ink-900">
                    지도 보기
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-[62ch] text-xs text-muted-foreground">
          각 조각에 실제 라임 버튼을 하나씩 올려 뒀습니다. 계절색을 넣고도 <strong>라임이 여전히
          화면에서 가장 먼저 보이는지</strong>가 이 테마의 합격 기준입니다.
        </p>
      </section>
    </main>
  );
}
