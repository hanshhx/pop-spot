import { parseDate, startOfDay } from './popupSlices';

/**
 * 랜딩 목록의 한 팝업이 지금 어떤 상태인가.
 *
 * <p>{@code ongoing} 이 {@code dday} 를 함께 들고 있는 것은 배지가 그 숫자로 색을 고르기
 * 때문이다(오늘 마감은 빨강, 사흘 이내는 주황, 그 밖은 라임). 상시 운영이면 셀 것이 없어 null 이다.
 */
export type LandingStatus =
  | { kind: 'upcoming'; opensIn: number }
  | { kind: 'ongoing'; dday: number | null }
  | { kind: 'ended' };

/** 두 날짜 사이의 일수. 읽을 수 없으면 null. */
function daysBetween(value: string | null, today: Date): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.round((startOfDay(parsed).getTime() - today.getTime()) / 86_400_000);
}

/**
 * 시작일과 종료일을 <b>둘 다</b> 보고 가른다.
 *
 * <p>예전에는 종료일만 봤고, 그래서 아직 열지 않은 팝업이 '진행 중' 으로 나왔다. 목록에서 가장
 * 강한 신호가 배지라, 그 한 칸이 틀리면 나머지가 다 맞아도 사람은 헛걸음한다.
 *
 * <p>날짜를 모르는 쪽은 <b>열려 있는 것으로</b> 본다. 이 목록은 이미 만료·오래된 것을 걸러낸
 * 뒤이므로, 여기 있다는 사실 자체가 "지금 볼 만하다" 는 뜻이다. 모른다고 숨기면 상시 운영
 * 팝업이 통째로 사라진다.
 */
export function landingStatus(
  startDate: string | null,
  endDate: string | null,
  today: Date,
): LandingStatus {
  const toEnd = daysBetween(endDate, today);
  if (toEnd !== null && toEnd < 0) return { kind: 'ended' };

  const toStart = daysBetween(startDate, today);
  if (toStart !== null && toStart > 0) return { kind: 'upcoming', opensIn: toStart };

  return { kind: 'ongoing', dday: toEnd };
}
