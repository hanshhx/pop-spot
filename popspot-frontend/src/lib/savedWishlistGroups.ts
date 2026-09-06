/**
 * 저장한 팝업을 <b>지금 갈 수 있는 것 · 곧 열리는 것 · 지난 것</b>으로 나눈다.
 *
 * <p><b>왜 나누나.</b> 카드마다 배지({@code savedPeriodBadge})가 붙어 있어도, 열 장이 섞여 있으면
 * 사용자는 그것을 하나씩 읽어야 한다. 저장한 목록을 여는 이유는 <b>"이번에 어디 가지"</b> 하나라
 * 화면이 그 답을 먼저 내놓아야 한다(계획서 §4.5 1번 "이번에 갈 곳").
 *
 * <p><b>왜 지난 것을 지우지 않나.</b> §4.5 가 못 박아 두었다 — "종료된 저장 기록을 곧바로 지우지
 * 않으며 현재 방문 추천과 보관 기록을 분리함". 담아 둔 것을 우리가 대신 버리지 않는다. 다만
 * 아래로 내리고 지난 것이라고 적는다.
 *
 * <p><b>왜 판정을 여기서 하나.</b> 화면이 답해야 하는 것이 네 가지 상태다 — 저장이 없음 · 지금 갈
 * 수 있는 것이 없음 · 전부 끝남 · 정보를 못 가져옴. 이걸 JSX 안의 삼항 연산자로 엮으면 어떤
 * 조합이 어느 화면을 내는지 아무도 확신할 수 없고, 브라우저 없이는 시험도 못 한다.
 */

import { savedPeriodBadge } from '@/lib/popupDetailStatus';
import { kstTodayStart } from '@/lib/popupSlices';
import type { WishlistItem } from '@/types/popup';

/**
 * 목록이 비어 보이는 <b>이유</b>. 화면은 이 값에 따라 다른 말을 한다.
 *
 * <p>"비어 있다" 를 한 가지로 뭉뚱그리면 <b>전부 끝난 사람</b>과 <b>아직 아무것도 안 담은
 * 사람</b>에게 같은 말을 하게 된다. 앞사람에게 "하트를 눌러보세요" 는 자기가 담은 것을 못 본
 * 채로 듣는 엉뚱한 안내다.
 */
export type SavedEmptiness =
  /** 보여줄 것이 있다. */
  | 'none'
  /** 담은 것이 하나도 없다. */
  | 'nothing-saved'
  /** 담은 것이 <b>전부 끝났다.</b> */
  | 'all-ended'
  /** 지금 갈 수 있는 것은 없지만 <b>곧 열리는 것이 있다.</b> */
  | 'only-upcoming'
  /** 지금 갈 수 있는 것이 없고, 곧 열리는 것과 지난 것이 섞여 있다. */
  | 'nothing-now';

export interface SavedWishlistGroups {
  /** 지금 갈 수 있는 것. 마감이 급한 순. */
  current: WishlistItem[];
  /** 아직 안 열린 것. 빨리 여는 순. */
  upcoming: WishlistItem[];
  /** 끝난 것. 담은 순서 그대로. */
  ended: WishlistItem[];
  emptiness: SavedEmptiness;
}

/**
 * 급한 순서를 매긴다. 작을수록 앞.
 *
 * <p><b>마감일을 모르는 것은 아는 것들 뒤에 둔다.</b> 앞에 세우면 "제일 급한 것" 자리를
 * 차지하는데, 정작 우리는 그것이 급한지조차 모른다. 뒤에 두는 것은 숨기는 것이 아니다 —
 * 카드에 "마감일 미정" 이라고 적혀 있다.
 *
 * <p>날짜를 아예 못 읽는 것은 맨 뒤다. 같은 이유이고 정도만 더하다.
 */
function urgency(item: WishlistItem, today: Date): number {
  const badge = savedPeriodBadge(item.startDate, item.endDate, today);
  if (badge === null) return Number.MAX_SAFE_INTEGER;
  if (badge.kind === 'closing-today') return 0;
  if (badge.kind === 'closes-in') return badge.days;
  if (badge.kind === 'open-undated') return Number.MAX_SAFE_INTEGER - 1;
  return Number.MAX_SAFE_INTEGER; // opens-in · ended 는 여기로 오지 않는다
}

/**
 * 저장 목록을 세 묶음으로 나누고, 비어 보이는 이유를 함께 돌려준다.
 *
 * <p><b>정렬은 묶음 안에서만 한다.</b> 담은 순서를 통째로 버리지 않기 위해서다 — 같은 상태끼리는
 * 담은 순서를 지키고(안정 정렬), 상태가 다를 때만 자리를 바꾼다.
 */
export function groupSavedWishlist(
  items: readonly WishlistItem[],
  today: Date = kstTodayStart(),
): SavedWishlistGroups {
  const current: WishlistItem[] = [];
  const upcoming: WishlistItem[] = [];
  const ended: WishlistItem[] = [];

  for (const item of items) {
    const badge = savedPeriodBadge(item.startDate, item.endDate, today);
    if (badge?.kind === 'ended') ended.push(item);
    else if (badge?.kind === 'opens-in') upcoming.push(item);
    // 날짜를 못 읽는 것(badge === null)은 갈 수 있는 쪽에 둔다. 끝났다는 근거가 없는데
    // 지난 것으로 내리면, 우리가 모른다는 이유로 사용자의 저장을 치워 버리는 셈이다.
    else current.push(item);
  }

  current.sort((a, b) => urgency(a, today) - urgency(b, today));
  upcoming.sort((a, b) => opensIn(a, today) - opensIn(b, today));

  return { current, upcoming, ended, emptiness: emptinessOf(current, upcoming, ended) };
}

function opensIn(item: WishlistItem, today: Date): number {
  const badge = savedPeriodBadge(item.startDate, item.endDate, today);
  return badge?.kind === 'opens-in' ? badge.days : Number.MAX_SAFE_INTEGER;
}

function emptinessOf(
  current: readonly WishlistItem[],
  upcoming: readonly WishlistItem[],
  ended: readonly WishlistItem[],
): SavedEmptiness {
  if (current.length > 0) return 'none';
  if (upcoming.length === 0 && ended.length === 0) return 'nothing-saved';
  if (ended.length > 0 && upcoming.length === 0) return 'all-ended';
  if (upcoming.length > 0 && ended.length === 0) return 'only-upcoming';
  return 'nothing-now';
}
