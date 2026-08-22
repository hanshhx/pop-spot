import { SEASONS, type Season, seasonOf } from '@/lib/season';

/**
 * 계절을 <b>손으로 고정</b>하는 값. 관리자가 바꾼다.
 *
 * <p>왜 쿠키인가 — 계절은 서버가 그리는 첫 HTML 에 이미 들어가 있어야 한다. 브라우저에만 있는
 * 값(localStorage)으로 정하면 서버는 날짜대로 그리고 브라우저가 뒤늦게 갈아치워서 <b>한 번
 * 깜빡인다.</b> 쿠키는 요청과 함께 서버에 도착하므로 첫 그림부터 맞다.
 *
 * <p>기본값은 <b>없음</b>이다 — 아무것도 안 하면 날짜를 따른다. 관리자가 계절을 바꿔 두고
 * 잊어버려도 되도록, 고정은 어디까지나 임시 조작으로 두고 원래 값(날짜)은 늘 계산해 둔다.
 */

export const SEASON_COOKIE = 'popspot_season';

/** 고정을 풀 때 쓰는 값. 빈 문자열은 "쿠키 삭제 실패" 와 구분되지 않아 쓰지 않는다. */
export const SEASON_AUTO = 'auto';

export type SeasonSetting = Season | typeof SEASON_AUTO;

/** 쿠키 값이 우리가 아는 계절인가. 모르는 값은 없는 것으로 친다 — 손으로 고친 쿠키를 믿지 않는다. */
export function parseSeasonSetting(value: string | null | undefined): SeasonSetting {
  if (!value) return SEASON_AUTO;
  return (SEASONS as readonly string[]).includes(value) ? (value as Season) : SEASON_AUTO;
}

/**
 * 화면에 쓸 계절.
 *
 * @param setting 관리자가 고정한 값. {@code 'auto'} 면 날짜를 따른다.
 * @param now 날짜 판정 기준. 시험에서 넘긴다.
 */
export function resolveSeason(setting: SeasonSetting, now: Date = new Date()): Season {
  return setting === SEASON_AUTO ? seasonOf(now) : setting;
}

/** 고정이 걸려 있는가 — 관리자 화면에서 "지금 손으로 잡혀 있음" 을 알리는 데 쓴다. */
export function isPinned(setting: SeasonSetting): setting is Season {
  return setting !== SEASON_AUTO;
}

/**
 * 쿠키 한 줄 만들기.
 *
 * <p>1년을 두는 이유는 계절이 네 번 도는 주기가 1년이라서다. {@code SameSite=Lax} 로 두어
 * 다른 사이트에서 걸어온 링크로 들어와도 계절이 유지되게 하되, 교차 사이트 요청에는 안 실린다.
 */
export function seasonCookie(setting: SeasonSetting): string {
  const base = `${SEASON_COOKIE}=${setting}; Path=/; SameSite=Lax`;
  // 고정을 풀 때는 값을 지운다. 'auto' 를 넣어 두면 나중에 기본 동작이 바뀌어도 이 쿠키가 발목을 잡는다.
  return setting === SEASON_AUTO
    ? `${SEASON_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`
    : `${base}; Max-Age=${60 * 60 * 24 * 365}`;
}
