import { mix } from '@/lib/colorMix';
import { BRAND_LIME, SEASON_SCALES, type SeasonScale } from '@/lib/seasonPalette';
import type { Season } from '@/lib/season';

/**
 * 화면이 쓰는 색 — 웹의 {@code globals.css} 가 하던 일.
 *
 * <p>웹은 CSS 변수 하나를 계절마다 덮어쓰면 647곳의 라임이 컴포넌트 수정 없이 따라온다. 앱에는
 * 그 장치가 없어서, <b>같은 구조를 객체로 만든다</b> — 계절 팔레트 위에 다크 오버레이를 얹는 2단
 * 합성이다. 계절 × 라이트/다크 = 10벌을 손으로 적으면 반드시 어긋난다.
 *
 * <h3>라임 스케일은 여기 없다</h3>
 *
 * <p>{@code lib/seasonPalette.ts} 가 단일 출처다. 시안의 {@code --l0~--l7} 은 그 스케일의
 * 50·100·200·300·400·500·700 과 <b>값이 같다</b>(대조해서 확인했다). 여기에 다시 적으면 웹과
 * 앱이 갈리고, 갈린 것을 알아채는 방법이 없다.
 *
 * <p>{@code --l6}·{@code --l8}·{@code --l9} 는 시안이 쓰지 않아 이름을 만들지 않았다. 필요해지면
 * 스케일에서 꺼내 쓴다.
 */

/** 계절과 무관한 표면 색 묶음 — 시안의 {@code [data-pv]} 블록. */
export interface SurfaceTokens {
  /** 만채도 강조. 로고 SPOT·핀·신호에만 쓴다(넓은 면에 칠하지 않는다). */
  hi: string;
  /** 보조 강조. */
  hi2: string;
  /** 라임 면 위에 얹는 글자색. 겨울만 흰색이다. */
  hif: string;
  /** 포인트(하트·절약·마감). */
  ac: string;
  /** 배경. */
  bg: string;
  /** 카드 면. */
  sf: string;
  /** 본문 글자. */
  ik: string;
  /** 보조 글자. */
  mu: string;
  /** 구분선. */
  ln: string;
  /** 지도·눌린 면. */
  mp: string;
  /** 지도 위 도로·건물. */
  mpl: string;
  /** 라임 옅은 배경(칩·배지). */
  sft: string;
  /** 보라 — 주간 요약 알림에만. */
  vi: string;
}

/** 라임 스케일에서 시안이 이름 붙인 단계만 꺼낸 것. */
export interface LimeTokens {
  l0: string;
  l1: string;
  l2: string;
  l3: string;
  l4: string;
  l5: string;
  l7: string;
}

export interface Tokens extends SurfaceTokens, LimeTokens {}

/**
 * 계절이 정해지기 전의 바탕 — 웹 {@code :root} 에 해당한다.
 *
 * <p>웹에서는 이 값이 계절 블록에 <b>항상 덮인다</b>(계절은 늘 하나로 정해진다). 그래도 지우지
 * 않는 이유는 시안이 이 상태를 "기본" 으로 보여주기 때문이다 — 브랜드 라임을 그대로 보고 싶을 때
 * 고르는 자리가 있어야 네 계절과 비교가 된다.
 */
const BRAND_SURFACE: SurfaceTokens = {
  hi: '#88c828',
  hi2: '#ffd23d',
  hif: '#0a0a0a',
  ac: '#ff3d7f',
  bg: '#f5f3ee',
  sf: '#ffffff',
  ik: '#0a0a0a',
  mu: '#3f3f3f',
  ln: 'rgba(10,10,10,.1)',
  mp: '#ece9e0',
  mpl: '#ddd9cb',
  sft: '#f5fde6',
  vi: '#7b61ff',
};

/**
 * 계절이 덮는 표면 색.
 *
 * <p>{@code sf}(카드 흰색)와 {@code vi}(보라)는 어느 계절도 건드리지 않아 여기 없다 — 적어 두면
 * "계절이 정하는 값" 처럼 보여서, 나중에 계절 하나만 고칠 때 나머지 넷도 함께 봐야 한다고 착각한다.
 */
const SEASON_SURFACE: Record<Season, Omit<SurfaceTokens, 'sf' | 'vi'>> = {
  spring: {
    hi: '#ef6f9b',
    hi2: '#8fc93a',
    hif: '#14100f',
    ac: '#d9718f',
    bg: '#fdf7f4',
    ik: '#14100f',
    mu: '#7a5c56',
    ln: '#e7d8d3',
    mp: '#f5ece8',
    mpl: '#e6d5cf',
    sft: '#fbe6ec',
  },
  summer: {
    hi: '#00a6c4',
    hi2: '#ffd23d',
    hif: '#0d1517',
    ac: '#3f9cba',
    bg: '#f5fafb',
    ik: '#0d1517',
    mu: '#4a6e78',
    ln: '#d3e4e9',
    mp: '#e7f1f4',
    mpl: '#d2e2e7',
    sft: '#ddeff5',
  },
  autumn: {
    hi: '#e2661a',
    hi2: '#f6c445',
    hif: '#17110a',
    ac: '#c9702f',
    bg: '#fdf6ec',
    ik: '#17110a',
    mu: '#7d6444',
    ln: '#e8dac2',
    mp: '#f4ebdc',
    mpl: '#e2d3ba',
    sft: '#f8e5d2',
  },
  winter: {
    hi: '#2f6ea8',
    hi2: '#8ec9ee',
    hif: '#ffffff',
    ac: '#4d7691',
    bg: '#f6f9fb',
    ik: '#0c1216',
    mu: '#546c7c',
    ln: '#d8e2e9',
    mp: '#e9f0f4',
    mpl: '#d6e0e7',
    sft: '#e2ecf2',
  },
};

/**
 * 다크가 덮는 것.
 *
 * <p><b>라임 스케일은 건드리지 않는다.</b> 어두운 바탕에서 라임은 그대로 읽히고, 여기서 낮추면
 * 계절색이 두 벌이 되어 대비 검증을 여덟 번 해야 한다. 다크는 바탕과 글자만 뒤집는 일이다.
 */
const DARK_SURFACE: Partial<SurfaceTokens> = {
  bg: '#0a0a0a',
  sf: '#161616',
  ik: '#d8d4ca',
  mu: '#9a958a',
  ln: 'rgba(245,243,238,.14)',
  mp: '#0f171b',
  mpl: '#1f2a30',
  sft: '#1b262b',
};

/** 스케일 → 시안이 쓰는 이름. */
function limeOf(scale: SeasonScale): LimeTokens {
  return {
    l0: scale[50],
    l1: scale[100],
    l2: scale[200],
    l3: scale[300],
    l4: scale[400],
    l5: scale[500],
    l7: scale[700],
  };
}

/** 계절을 고르지 않은 상태를 뜻한다. 시안 레일의 "기본". */
export type ThemeSeason = Season | 'brand';

/**
 * 지금 화면이 쓸 색 한 벌.
 *
 * @param season 계절, 또는 브랜드 라임을 그대로 쓰는 {@code 'brand'}.
 * @param dark   다크 여부.
 */
export function tokensFor(season: ThemeSeason, dark: boolean): Tokens {
  const surface: SurfaceTokens =
    season === 'brand' ? BRAND_SURFACE : { ...BRAND_SURFACE, ...SEASON_SURFACE[season] };
  const lime = limeOf(season === 'brand' ? BRAND_LIME : SEASON_SCALES[season]);
  return { ...surface, ...lime, ...(dark ? DARK_SURFACE : null) };
}

/**
 * 시안이 {@code color-mix(in srgb, var(--l3) N%, var(--sf))} 로 적어 둔 값.
 *
 * <p>알림 센터의 안 읽음 카드가 이걸 쓴다. RN 에는 {@code color-mix()} 가 없어 미리 섞는다 —
 * {@code lib/colorMix.ts} 의 주석이 말하는 그 자리다.
 */
export function tintOnSurface(t: Tokens, percent: number): string {
  return mix(t.sf, t.l3, percent / 100);
}
