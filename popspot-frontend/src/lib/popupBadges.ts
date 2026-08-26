import { landingStatus } from './landingStatus';
import { parseDate, startOfDay } from './popupSlices';

/** 마감 배지를 다는 기준 — 며칠 남았을 때부터 급한가. */
export const CLOSING_SOON_DAYS = 3;

/**
 * 목록의 한 칸이 달 수 있는 배지. 없으면 null.
 *
 * <p>배지는 <b>한 팝업에 하나만</b> 붙는다. 두 개가 붙으면 칸이 좁아지는 것보다 나쁜 일이
 * 생긴다 — 무엇을 먼저 읽어야 할지가 사라진다.
 */
export type PopupBadge =
  | { kind: 'openingToday' }
  | { kind: 'closingSoon'; dday: number }
  | { kind: 'upcoming'; opensIn: number }
  | null;

/** 오늘로부터 며칠 뒤인가. 읽을 수 없으면 null. */
function daysUntil(value: string | null | undefined, today: Date): number | null {
  const parsed = parseDate(value ?? null);
  if (!parsed) return null;
  return Math.round((startOfDay(parsed).getTime() - today.getTime()) / 86_400_000);
}

/**
 * 팝업 하나가 달 배지를 고른다.
 *
 * <p><b>우선순위는 마감이 먼저다.</b> 오늘 열고 내일 닫는 팝업이 있을 때 「오늘 오픈」을
 * 보여주면 사실이긴 해도 사람을 헛걸음시킨다. 배지가 하는 일은 소식 전달이 아니라
 * <b>계획을 바꾸는 것</b>이고, 계획을 바꾸는 쪽은 언제나 마감이다.
 *
 * <p>날짜를 모르면 배지를 달지 않는다. 이 목록은 이미 만료된 것을 걸러낸 뒤라 날짜 미상은
 * 상시 운영에 가깝다 — 모르는 것을 급한 것으로 바꿔 말하지 않는다.
 *
 * <p><b>넉 달 남은 팝업에는 아무것도 달지 않는다.</b> 예전 {@code ddayBadge} 는 종료일이
 * 읽히는 모든 팝업에 배지를 달았고 색도 전부 같았다 — 그래서 화면에서 D-1 과 D-127 이
 * 구별되지 않았다. 모두에게 주는 배지는 신호가 아니라 배경이다.
 */
export function popupBadge(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: Date,
): PopupBadge {
  const status = landingStatus(startDate ?? null, endDate ?? null, today);
  if (status.kind === 'ended') return null;
  if (status.kind === 'upcoming') return { kind: 'upcoming', opensIn: status.opensIn };

  if (status.dday !== null && status.dday <= CLOSING_SOON_DAYS) {
    return { kind: 'closingSoon', dday: status.dday };
  }
  if (daysUntil(startDate, today) === 0) return { kind: 'openingToday' };
  return null;
}
