import { popupBadge, type PopupBadge } from '@/lib/popupBadges';
import type { Tokens } from '@/theme/tokens';

/**
 * 배지가 <b>무엇을 말할지</b>는 웹이 정하고, <b>어떻게 보일지</b>는 시안이 정한다.
 *
 * <p>둘을 한 함수에 섞지 않는다. 판정({@code popupBadge})은 이미 웹에서 테스트까지 딸린 채로
 * 이식돼 있고, 여기서 다시 조건을 쓰면 두 벌이 된다 — 웹이 "마감이 오늘 오픈보다 먼저다" 를
 * 고쳐도 앱은 옛 규칙으로 남는다.
 *
 * <p>색은 시안의 {@code badgeOf} 에서 온다. 셋으로 갈린다 — 오늘 오픈은 라임, 사흘 이내는 핫핑크,
 * 그 밖은 반투명 잉크.
 */

export interface BadgeVisual {
  label: string;
  bg: string;
  fg: string;
  /** 시안이 사흘 이내에만 배지를 다는 자리가 있다(전체보기·음악 카드). */
  urgent: boolean;
}

/** 마감 임박으로 보는 기준. 시안의 핫핑크. */
const HOT = '#ee1a64';

export function badgeVisual(badge: PopupBadge, t: Tokens): BadgeVisual | null {
  if (!badge) return null;

  if (badge.kind === 'openingToday') {
    return { label: '오늘 오픈', bg: t.l3, fg: t.hif, urgent: true };
  }
  if (badge.kind === 'closingSoon') {
    return { label: `D-${badge.dday}`, bg: HOT, fg: '#fff', urgent: true };
  }
  /* 아직 열지 않은 곳. 시안에는 이 상태가 없지만 웹 판정에는 있다 — 없는 색을 지어내는 대신
     "그 밖" 과 같은 차분한 배지를 준다. */
  return { label: `${badge.opensIn}일 뒤 오픈`, bg: 'rgba(10,10,10,.65)', fg: '#fff', urgent: false };
}

/** 팝업 하나의 배지를 한 번에. */
export function popupBadgeVisual(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: Date,
  t: Tokens,
): BadgeVisual | null {
  return badgeVisual(popupBadge(startDate, endDate, today), t);
}
