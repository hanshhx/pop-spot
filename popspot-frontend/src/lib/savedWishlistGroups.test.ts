import { describe, expect, it } from 'vitest';

import { groupSavedWishlist } from './savedWishlistGroups';
import type { WishlistItem } from '@/types/popup';

/**
 * <b>"비어 있다" 는 한 가지가 아니다.</b>
 *
 * <p>담은 것이 없는 사람과 담은 것이 전부 끝난 사람에게 같은 말을 하면, 뒷사람은 자기가 담은
 * 것을 못 본 채 "하트를 눌러보세요" 를 듣는다. 계획서가 네 상태를 각각 설계하라고 한 이유다.
 */

const TODAY = new Date('2026-09-06');

const item = (name: string, startDate: string, endDate: string): WishlistItem => ({
  wishlistId: 1,
  popupId: 1,
  popupName: name,
  popupImage: '',
  location: '서울',
  startDate,
  endDate,
});

const names = (list: readonly WishlistItem[]) => list.map((i) => i.popupName);

const 진행 = item('진행', '2026-09-01', '2026-09-30');
const 급함 = item('급함', '2026-09-01', '2026-09-08');
const 오늘마감 = item('오늘마감', '2026-09-01', '2026-09-06');
const 마감미정 = item('마감미정', '2026-09-01', '');
const 날짜없음 = item('날짜없음', '', '');
const 예정 = item('예정', '2026-09-15', '2026-09-23');
const 먼예정 = item('먼예정', '2026-11-01', '2026-11-10');
const 끝남 = item('끝남', '2024-01-01', '2024-04-30');

describe('묶기', () => {
  it('지금 갈 수 있는 것 · 곧 열리는 것 · 지난 것으로 나눈다', () => {
    const g = groupSavedWishlist([진행, 예정, 끝남], TODAY);
    expect(names(g.current)).toEqual(['진행']);
    expect(names(g.upcoming)).toEqual(['예정']);
    expect(names(g.ended)).toEqual(['끝남']);
  });

  /*
   * 끝났다는 근거가 없는데 지난 것으로 내리면, 우리가 모른다는 이유로 사용자의 저장을 치우는
   * 셈이 된다. 팝업의 60%에 마감일이 없으므로 이 판단이 목록 대부분을 좌우한다.
   */
  it('마감일을 모르는 것은 갈 수 있는 쪽에 둔다', () => {
    const g = groupSavedWishlist([마감미정], TODAY);
    expect(names(g.current)).toEqual(['마감미정']);
    expect(g.ended).toEqual([]);
  });

  it('날짜를 아예 못 읽는 것도 지난 것으로 내리지 않는다', () => {
    const g = groupSavedWishlist([날짜없음], TODAY);
    expect(names(g.current)).toEqual(['날짜없음']);
  });
});

describe('순서', () => {
  it('갈 수 있는 것은 마감이 급한 순', () => {
    const g = groupSavedWishlist([진행, 오늘마감, 급함], TODAY);
    expect(names(g.current)).toEqual(['오늘마감', '급함', '진행']);
  });

  /*
   * 마감일을 모르는 것을 앞에 세우면 "제일 급한 것" 자리를 차지하는데, 정작 급한지조차 모른다.
   * 숨기는 것이 아니다 — 카드에 "마감일 미정" 이라고 적혀 있고 같은 묶음 안에 있다.
   */
  it('마감일을 모르는 것은 아는 것들 뒤에', () => {
    const g = groupSavedWishlist([마감미정, 진행], TODAY);
    expect(names(g.current)).toEqual(['진행', '마감미정']);
  });

  it('날짜를 못 읽는 것은 맨 뒤', () => {
    const g = groupSavedWishlist([날짜없음, 마감미정, 진행], TODAY);
    expect(names(g.current)).toEqual(['진행', '마감미정', '날짜없음']);
  });

  it('곧 열리는 것은 빨리 여는 순', () => {
    const g = groupSavedWishlist([먼예정, 예정], TODAY);
    expect(names(g.upcoming)).toEqual(['예정', '먼예정']);
  });

  /* 상태가 같으면 담은 순서를 지킨다 — 통째로 다시 늘어놓지 않는다. */
  it('같은 상태끼리는 담은 순서 그대로', () => {
    const a = item('a', '2026-09-01', '2026-09-30');
    const b = item('b', '2026-09-01', '2026-09-30');
    const c = item('c', '2026-09-01', '2026-09-30');
    expect(names(groupSavedWishlist([c, a, b], TODAY).current)).toEqual(['c', 'a', 'b']);
  });

  it('지난 것도 담은 순서 그대로', () => {
    const old1 = item('old1', '2024-01-01', '2024-02-01');
    const old2 = item('old2', '2023-01-01', '2023-02-01');
    expect(names(groupSavedWishlist([old1, old2], TODAY).ended)).toEqual(['old1', 'old2']);
  });
});

describe('비어 보이는 이유 — 네 가지를 가른다', () => {
  it('담은 것이 없다', () => {
    expect(groupSavedWishlist([], TODAY).emptiness).toBe('nothing-saved');
  });

  /* 전부 끝난 사람에게 "하트를 눌러보세요" 는 자기가 담은 것을 못 본 채 듣는 엉뚱한 말이다. */
  it('담은 것이 전부 끝났다', () => {
    expect(groupSavedWishlist([끝남], TODAY).emptiness).toBe('all-ended');
  });

  it('지금 갈 곳은 없지만 곧 열리는 것이 있다', () => {
    expect(groupSavedWishlist([예정], TODAY).emptiness).toBe('only-upcoming');
  });

  it('곧 열리는 것과 지난 것이 섞여 있다', () => {
    expect(groupSavedWishlist([예정, 끝남], TODAY).emptiness).toBe('nothing-now');
  });

  it('갈 수 있는 것이 하나라도 있으면 비어 있지 않다', () => {
    expect(groupSavedWishlist([진행, 끝남], TODAY).emptiness).toBe('none');
    expect(groupSavedWishlist([마감미정], TODAY).emptiness).toBe('none');
  });
});
