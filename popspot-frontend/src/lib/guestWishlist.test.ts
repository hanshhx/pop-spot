// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GUEST_WISHLIST_KEY,
  GUEST_WISHLIST_MAX,
  clearGuestWishlist,
  isGuestWished,
  readGuestWishlist,
  restoreGuestWishlist,
  takeGuestWishlist,
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

describe('로그인할 때 서버로 옮기기', () => {
  it('꺼내면서 비운다 — 같은 것을 두 번 올리지 않게', () => {
    toggleGuestWishlist(1);
    toggleGuestWishlist(2);
    expect(takeGuestWishlist()).toEqual([1, 2]);
    expect(readGuestWishlist()).toEqual([]);
  });

  it('빈 목록을 꺼내도 아무 일도 없다', () => {
    expect(takeGuestWishlist()).toEqual([]);
  });

  /* 서버로 못 옮긴 것을 되돌리는 길이 없으면, 전송 실패가 곧 소실이 된다. */
  it('못 옮긴 것을 되돌려 놓을 수 있다', () => {
    toggleGuestWishlist(9);
    const taken = takeGuestWishlist();
    restoreGuestWishlist(taken);
    expect(readGuestWishlist()).toEqual([9]);
  });

  it('되돌릴 때 이미 담긴 것과 중복되지 않는다', () => {
    toggleGuestWishlist(1);
    const taken = takeGuestWishlist();
    toggleGuestWishlist(1); // 그 사이 같은 것을 다시 담았다
    toggleGuestWishlist(2);
    restoreGuestWishlist(taken);
    expect(readGuestWishlist()).toEqual([1, 2]);
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
