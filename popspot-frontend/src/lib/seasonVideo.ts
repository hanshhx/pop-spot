import type { Season } from '@/lib/season';

/**
 * 계절 × 테마 → 배경 영상 파일.
 *
 * <h3>영상은 데스크탑에서만 튼다</h3>
 *
 * <p>좁은 화면에서는 아예 <b>내려받지 않는다.</b> CSS 로 숨기는 것으로는 부족하다 —
 * {@code <video>} 가 문서에 있으면 보이지 않아도 파일을 받는다. 2.8MB 짜리를 셀룰러로 받게 하는
 * 것은 배경 하나 값으로 치를 대가가 아니다. 좁은 화면의 배경은 계절색이 맡는다(globals.css).
 *
 * <h3>없는 계절은 지금 영상으로 물러선다</h3>
 *
 * <p>파일이 없는데 경로만 적어 두면 화면이 <b>검은 사각형</b>이 된다. 그래서 "있다고 아는 것" 만
 * 목록에 둔다. 새 계절 영상을 넣을 때는 파일을 두고 이 목록에 한 줄 추가한다 —
 * 파일 존재를 코드가 짐작하지 않게 하려는 것이다.
 */

export type ThemeMode = 'light' | 'dark';

/** 지금 사이트가 쓰던 영상. 계절 영상이 없을 때 여기로 물러선다. */
const FALLBACK: Record<ThemeMode, string> = {
  light: '/light-bg.mp4',
  dark: '/login-bg-v2.mp4',
};

/**
 * 계절 영상이 <b>실제로 있는</b> 조합.
 *
 * <p>파일을 {@code public/season/} 에 두고 여기에 적으면 그때부터 쓰인다.
 * 이름 규칙: {@code {계절}-{light|dark}.mp4} — 예) {@code summer-dark.mp4}.
 */
const AVAILABLE: Partial<Record<Season, Partial<Record<ThemeMode, true>>>> = {
  // 여기에 넣기 전에 파일이 public/season/ 에 있는지 확인할 것.
  // (확인은 사람 손에 맡기지 않는다 — seasonVideo.test.ts 가 여덟 개 전부 실제로 있는지 본다.)
  spring: { light: true, dark: true },
  summer: { light: true, dark: true },
  autumn: { light: true, dark: true },
  winter: { light: true, dark: true },
};

/** 계절 영상 경로. 파일이 있든 없든 규칙은 하나다. */
export function seasonVideoPath(season: Season, mode: ThemeMode): string {
  return `/season/${season}-${mode}.mp4`;
}

/**
 * 지금 틀 영상.
 *
 * @param season 화면에 적용된 계절
 * @param mode 라이트/다크
 */
export function backgroundVideoSrc(season: Season, mode: ThemeMode): string {
  return AVAILABLE[season]?.[mode] ? seasonVideoPath(season, mode) : FALLBACK[mode];
}

/** 이 조합에 계절 영상이 준비돼 있는가 — 관리자 화면에서 무엇이 비었는지 보여주는 데 쓴다. */
export function hasSeasonVideo(season: Season, mode: ThemeMode): boolean {
  return Boolean(AVAILABLE[season]?.[mode]);
}

/**
 * 재생 속도.
 *
 * <p>속도는 <b>모드가 아니라 그 파일</b>의 성질이다. 그래서 소스를 정하는 이 자리에서 같이 정한다 —
 * 화면 쪽에서 "라이트면 0.5" 같은 규칙을 다시 쓰면, 물러선 영상과 계절 영상에 같은 값이 걸린다.
 *
 * <p>계절 영상은 여덟 개 모두 0.6 이다. 고른 그림이 전부 느린 것들이라 더 늦추면 배경이 뒤로
 * 물러나고, 봄 다크(은하수)는 타임랩스라 정속으로 틀면 별이 눈에 띄게 흘러 시선을 끈다.
 */
export function backgroundVideoRate(season: Season, mode: ThemeMode): number {
  if (hasSeasonVideo(season, mode)) return 0.6;
  // 물러선 영상은 예전 값 그대로 둔다. 밝은 스카이라인은 절반으로 늦춰야 조용해졌고,
  // 야경은 원래 느려서 정속이었다.
  return mode === 'light' ? 0.5 : 1;
}

/**
 * 영상을 틀 화면인가.
 *
 * <p>1024px 은 하단 도크가 사라지는 폭과 같다({@code lg}). 그보다 좁으면 손에 들고 보는 화면으로
 * 간주하고 영상을 받지 않는다.
 */
export const VIDEO_MIN_WIDTH = 1024;
