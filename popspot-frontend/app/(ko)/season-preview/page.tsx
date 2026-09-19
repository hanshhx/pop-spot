import type { Metadata } from 'next';

import { SEASONS, SEASON_COPY, SEASON_LABEL, seasonOfNow, type Season } from '@/lib/season';

/**
 * 계절 테마 확인용 화면. <b>서비스 화면이 아니다.</b>
 *
 * <p>계절은 1년에 네 번만 바뀌므로 실제 화면에서는 지금 계절 하나밖에 볼 수 없다. 넷을 나란히
 * 놓아야 "겨울만 유난히 튀는지", "가을 라임 위의 잉크 글자가 봄만큼 읽히는지" 같은 것이 보인다.
 * 관리자 패널의 토큰 미리보기는 <b>적용 중인 한 계절</b>만 보여 주므로 그 비교가 안 된다.
 *
 * <h3>중첩 data-season 으로 그린다</h3>
 *
 * <p>네 칸이 각자 {@code data-season} 을 달고 자기 토큰을 다시 정의한다. globals.css 의 계절
 * 블록에 {@code :root} 없는 짝이 있어서 이게 먹는다 — 그 짝은 SEO 랜딩(lib/landingSeason)이
 * 쓰려고 연 문이고, 이 화면이 그 문이 실제로 열려 있는지 보여 주는 증거이기도 하다.
 *
 * <h3>라이트·다크를 한 화면에 같이 놓지 않는다</h3>
 *
 * <p>다크 토큰은 {@code :root.dark} 아래에서만 살아서, 한 화면에 둘을 같이 놓으려면 여덟 블록을
 * 통째로 한 벌 더 복제해야 한다. QA 화면 하나를 위해 팔레트를 이중으로 관리하는 것은 값이 맞지
 * 않는다 — 대신 테마를 토글해 두 번 본다.
 */
export const metadata: Metadata = {
  title: '계절 테마 미리보기',
  // 검색에 잡히면 안 된다. 서비스 화면이 아니고 내용도 팝업 정보가 아니다.
  robots: { index: false, follow: false },
};

/** 실제 카드 한 장을 흉내 낸다. 토큰은 이런 덩어리로 봐야 어긋난 것이 보인다. */
function SampleCard({ season }: { season: Season }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: 'var(--s-surface)', borderColor: 'var(--s-line)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold" style={{ color: 'var(--s-ink)' }}>
          성수 팝업스토어
        </p>
        {/* 강조 신호. 만채도라 좁은 자리에만 — 글자색은 --s-hi-fg 다(흰색으로 통일하면 여덟 중
            일곱이 AA 미달이라는 것이 globals.css 주석의 요지다). */}
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: 'var(--s-hi)', color: 'var(--s-hi-fg)' }}
        >
          D-2
        </span>
      </div>

      <p className="mt-1 text-xs" style={{ color: 'var(--s-muted)' }}>
        서울 성동구 연무장길 · {SEASON_COPY[season].months}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        {/* 이 화면의 핵심. 라임 스케일이 계절마다 통째로 갈리므로, 네 계절 모두에서 이 버튼이
            여전히 "지금 누를 것" 으로 먼저 읽히는지가 이 테마의 합격 기준이다. */}
        <span className="rounded-pill bg-lime-300 px-2.5 py-1 text-[11px] font-bold text-ink-900">
          지도 보기
        </span>
        <span className="text-[11px] font-black" style={{ color: 'var(--s-accent)' }}>
          42곳
        </span>
      </div>
    </div>
  );
}

/** 토큰 자체를 색 띠로. 카드만 보면 "왜 이 색인지" 가 안 보인다. */
function Swatches() {
  const tokens = [
    ['배경', 'var(--s-bg)'],
    ['카드', 'var(--s-surface)'],
    ['주 동작', 'var(--color-lime-300)'],
    ['기간', 'var(--s-accent)'],
    ['신호', 'var(--s-hi)'],
    ['보조', 'var(--s-hi2)'],
  ] as const;

  return (
    <div className="mt-2 flex gap-1">
      {tokens.map(([label, value]) => (
        <div key={label} className="flex-1">
          <div
            className="h-6 rounded-md border"
            style={{ background: value, borderColor: 'var(--s-line)' }}
          />
          <p className="mt-1 text-[9px]" style={{ color: 'var(--s-muted)' }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function SeasonColumn({ season, today }: { season: Season; today: Season }) {
  return (
    <div
      data-season={season}
      className="rounded-2xl border p-3"
      style={{ background: 'var(--s-bg)', borderColor: 'var(--s-line)' }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-black" style={{ color: 'var(--s-ink)' }}>
          {SEASON_LABEL[season]}
          <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--s-muted)' }}>
            {SEASON_COPY[season].upper}
          </span>
        </p>
        {season === today && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: 'var(--s-soft)', color: 'var(--s-accent)' }}
          >
            오늘
          </span>
        )}
      </div>

      <SampleCard season={season} />
      <Swatches />
    </div>
  );
}

export default function SeasonPreviewPage() {
  const today = seasonOfNow();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-7">
        <p className="text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          popspot
        </p>
        <h1 className="mt-1 text-3xl font-black">계절 테마 미리보기</h1>
        <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
          계절이 바꾸는 것은 <strong>라임 스케일 전체</strong>와 배경의 색온도, 그리고 신호 색
          둘입니다. 신호는 D-day 배지·건수처럼 좁은 자리에만 들어갑니다 — 화면 전체를 옅게 물들이는
          방식은 아무도 알아채지 못합니다.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-pill bg-black/[0.05] px-3 py-1.5 text-sm font-bold dark:bg-white/10">
          오늘 · {SEASON_LABEL[today]}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SEASONS.map((season) => (
          <SeasonColumn key={season} season={season} today={today} />
        ))}
      </div>

      <p className="mt-4 max-w-[62ch] text-xs text-muted-foreground">
        네 칸은 지금 테마(라이트/다크)를 따릅니다. 다크는 라이트에서 계산해 만들 수 없어 값을 따로
        적어 두었으므로, 테마를 바꿔 <strong>여덟 조합을 두 번에 나눠</strong> 확인해 주세요.
      </p>
    </main>
  );
}
