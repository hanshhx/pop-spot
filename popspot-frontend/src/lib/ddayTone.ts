/**
 * 마감 배지의 <b>색</b>을 한 곳에서 정한다.
 *
 * <p>같은 배지를 세 곳이 각자 칠하고 있었다 — 홈 카드({@code PopupCard}), 랜딩 목록
 * ({@code app/popups/[slug]}), 상세({@code PopupDetailClient}). 그래서 같은 팝업이 화면마다
 * 다른 색으로 보였고, 색을 하나 고치려면 세 군데를 찾아다녀야 했다.
 *
 * <p>문구는 여기서 정하지 않는다. 홈은 i18n 키를 쓰고 랜딩은 자기 {@code LandingCopy} 를 쓰는데,
 * 그 둘을 억지로 합치면 이 파일이 두 체계를 다 알아야 한다. <b>색만</b> 모은다.
 *
 * <h3>왜 네 색에서 두 색으로 줄였나</h3>
 *
 * <p>빨강(오늘·내일) · 주황(3일) · 호박(7일) · 라임(그 외) 네 가지였다. 목록을 훑을 때 넷 다
 * 강조색이라 <b>어디를 먼저 봐야 하는지가 사라진다.</b> 다 강조하면 아무것도 강조가 아니다.
 *
 * <p>이제 색을 쓰는 것은 <b>3일 이하</b>뿐이다. 그것이 실제로 지금 움직여야 하는 정보다.
 * 나머지는 회색 알약으로 두어 "정보는 있지만 급하지 않다" 를 말한다.
 */

export type DdayTone =
  /** 이미 끝남. 목록에 남아 있어도 누를 이유가 없다. */
  | 'ended'
  /** 3일 이하. 화면에서 유일하게 색을 쓰는 자리. */
  | 'urgent'
  /** 4일 이상 또는 상시. */
  | 'calm';

/** 색을 쓰는 마지막 날. 이 값 이하만 눈에 띈다. */
export const URGENT_DAYS = 3;

/**
 * @param daysLeft 오늘 기준 남은 일수. 음수면 끝난 것, {@code null} 이면 마감일을 모르는 것
 * @returns 배지를 그리지 않아야 하면 {@code null}
 */
export function ddayTone(daysLeft: number | null): DdayTone | null {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return 'ended';
  return daysLeft <= URGENT_DAYS ? 'urgent' : 'calm';
}

/**
 * 배지 색.
 *
 * <p>급한 배지는 핫핑크 위 <b>검정</b>이다. 흰 글씨는 대비가 3.37:1 로 기준(4.5)에 못 미친다 —
 * 작고 굵은 글씨는 '큰 글자' 예외를 받지 못한다. 검정을 얹으면 5.87:1 이고, 라임 위에도 검정을
 * 쓰는 이 브랜드의 규칙과도 맞는다.
 */
export const DDAY_TONE_CLASS: Record<DdayTone, string> = {
  // 계절 신호가 들어가는 다섯 자리 중 하나. 그리드에 여덟 번 반복되므로 면적 없이 빈도로
  // 존재감을 낸다 — 넓은 면을 물들이는 대신 좁은 자리에 만채도를 쓰는 것이 이 테마의 방식이다.
  urgent: 'season-signal',
  calm: 'bg-black/[0.06] text-ink-600 dark:bg-white/10 dark:text-white/75',
  ended: 'bg-black/[0.55] text-white/85 dark:bg-white/15 dark:text-white/70',
};
