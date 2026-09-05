// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GUEST_WISHLIST_KEY,
  GUEST_WISHLIST_MAX,
  clearGuestWishlist,
  forgetGuestWishlist,
  isGuestWished,
  readGuestWishlist,
  removeGuestWishlist,
  toggleGuestWishlist,
} from './guestWishlist';

/**
 * 이 목록은 사용자가 <b>가입하기 전에 모은 것</b>이다. 여기서 잃으면 가입한 순간 사라지고,
 * 그건 가입을 손해로 만든다. 아래 시험이 지키는 것은 대부분 "잃지 않는다" 이다.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe('담고 빼기', () => {
  it('담으면 남고, 다시 누르면 빠진다', () => {
    expect(toggleGuestWishlist(7)).toBe(true);
    expect(isGuestWished(7)).toBe(true);
    expect(toggleGuestWishlist(7)).toBe(false);
    expect(isGuestWished(7)).toBe(false);
  });

  it('담은 순서를 지킨다', () => {
    toggleGuestWishlist(3);
    toggleGuestWishlist(1);
    toggleGuestWishlist(2);
    expect(readGuestWishlist()).toEqual([3, 1, 2]);
  });

  it('같은 것을 두 번 담아도 하나다', () => {
    toggleGuestWishlist(5);
    toggleGuestWishlist(5); // 해제
    toggleGuestWishlist(5); // 다시 담기
    expect(readGuestWishlist()).toEqual([5]);
  });

  /* 상한을 넘으면 방금 담은 것이 아니라 가장 오래된 것이 빠져야 한다. */
  it('상한을 넘으면 오래된 것부터 버린다', () => {
    for (let i = 1; i <= GUEST_WISHLIST_MAX + 3; i++) toggleGuestWishlist(i);
    const ids = readGuestWishlist();
    expect(ids).toHaveLength(GUEST_WISHLIST_MAX);
    expect(ids).toContain(GUEST_WISHLIST_MAX + 3); // 방금 담은 것
    expect(ids).not.toContain(1); // 가장 오래된 것
  });
});

describe('목록에서 빼기', () => {
  it('담긴 것을 뺀다', () => {
    toggleGuestWishlist(1);
    toggleGuestWishlist(2);
    removeGuestWishlist(1);
    expect(readGuestWishlist()).toEqual([2]);
  });

  /*
   * 이 시험이 이 함수가 따로 있는 이유다. toggle 로 대신하면 "없을 때 담아 버린다" —
   * 화면과 저장소가 어긋난 순간 빼기 버튼이 담기 버튼으로 둔갑한다.
   */
  it('없는 것을 빼도 담기지 않는다', () => {
    toggleGuestWishlist(1);
    removeGuestWishlist(99);
    expect(readGuestWishlist()).toEqual([1]);
  });

  it('빈 목록에서 빼도 죽지 않는다', () => {
    removeGuestWishlist(1);
    expect(readGuestWishlist()).toEqual([]);
  });
});

/*
 * 예전에는 여기에 "꺼내면서 비우기(take)" 와 "못 옮긴 것 되돌리기(restore)" 가 있었다. 둘 다
 * 지웠다. 비우는 것이 전송보다 먼저라 중간에 탭이 닫히면 되돌릴 것 자체가 없었고, restore 는
 * 되돌리는 것을 배열 <b>앞</b>에 붙이면서 상한은 <b>뒤</b>를 지키게 잘라서 목록이 차 있으면
 * 되돌린 것이 통째로 사라졌다. 지금은 옮기기가 끝난 뒤 <b>서버에 있는 것이 확인된 id 만</b> 뺀다.
 */
describe('옮겨진 것만 목록에서 빼기', () => {
  it('지정한 것만 빠지고 나머지는 순서 그대로 남는다', () => {
    toggleGuestWishlist(1);
    toggleGuestWishlist(2);
    toggleGuestWishlist(3);
    expect(forgetGuestWishlist([1, 3])).toBe(2);
    expect(readGuestWishlist()).toEqual([2]);
  });

  /*
   * 이 시험이 이 함수가 "빼야 할 것" 만 받는 이유다. 옮기는 동안 사용자는 계속 담을 수 있는데,
   * 시작할 때 읽어 둔 배열을 그대로 되쓰면 그 창에서 담은 것이 조용히 지워진다. 예전 구현이
   * 정확히 그랬다.
   */
  it('옮기는 사이에 새로 담은 것은 건드리지 않는다', () => {
    toggleGuestWishlist(1);
    const sending = readGuestWishlist(); // 이 시점에 서버로 보낸 목록
    toggleGuestWishlist(2); // 응답을 기다리는 사이에 사용자가 하나 더 담았다
    forgetGuestWishlist(sending);
    expect(readGuestWishlist()).toEqual([2]);
  });

  it('없는 것을 빼라고 해도 아무 일도 없다', () => {
    toggleGuestWishlist(1);
    expect(forgetGuestWishlist([99])).toBe(0);
    expect(readGuestWishlist()).toEqual([1]);
  });

  it('빈 목록을 넘기면 저장소를 건드리지 않는다', () => {
    toggleGuestWishlist(1);
    expect(forgetGuestWishlist([])).toBe(0);
    expect(readGuestWishlist()).toEqual([1]);
  });

  /* 목록이 상한까지 차 있어도 빼기만 하므로 잘려 나가는 것이 없어야 한다. */
  it('목록이 가득 차 있어도 남은 것을 잃지 않는다', () => {
    for (let i = 1; i <= GUEST_WISHLIST_MAX; i++) toggleGuestWishlist(i);
    forgetGuestWishlist([1]);
    expect(readGuestWishlist()).toHaveLength(GUEST_WISHLIST_MAX - 1);
    expect(readGuestWishlist()).toContain(GUEST_WISHLIST_MAX);
  });
});

describe('망가진 저장소', () => {
  it('남이 넣어 둔 값이 있어도 죽지 않는다', () => {
    window.localStorage.setItem(GUEST_WISHLIST_KEY, '{"not":"an array"}');
    expect(readGuestWishlist()).toEqual([]);
    expect(toggleGuestWishlist(1)).toBe(true);
    expect(readGuestWishlist()).toEqual([1]);
  });

  it('숫자가 아닌 항목은 걸러낸다', () => {
    window.localStorage.setItem(GUEST_WISHLIST_KEY, '[1,"2",null,3.5,-4,0,5]');
    expect(readGuestWishlist()).toEqual([1, 5]);
  });

  it('JSON 이 아니어도 죽지 않는다', () => {
    window.localStorage.setItem(GUEST_WISHLIST_KEY, 'not json at all');
    expect(readGuestWishlist()).toEqual([]);
  });

  /*
   * 시크릿 창·저장소 차단에서는 setItem 이 던진다. 그때도 버튼은 눌린 것처럼 보여야 한다 —
   * 새로고침하면 사라지지만, 눌러도 아무 반응이 없는 것보다는 낫다.
   */
  it('저장소가 막혀 있어도 누른 결과를 정직하게 돌려준다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(toggleGuestWishlist(1)).toBe(true);
    vi.restoreAllMocks();
  });

  it('읽기가 막혀 있어도 빈 목록으로 동작한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readGuestWishlist()).toEqual([]);
    expect(isGuestWished(1)).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('비우기', () => {
  it('지우면 없다', () => {
    toggleGuestWishlist(1);
    clearGuestWishlist();
    expect(readGuestWishlist()).toEqual([]);
  });
});
