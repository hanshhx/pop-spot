// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DISCOVER_SKIP_KEY,
  DISCOVER_SKIP_MAX,
  clearSkipped,
  getSkipSnapshot,
  isSkipped,
  readSkipped,
  skipPopup,
  unskipPopup,
} from './discoverySkips';

/**
 * 넘기기는 <b>이번 탐색에서만</b>이다. 기획 §4.4 — "'넘기기' 는 이번 탐색에서 제외하는 뜻이며
 * <b>영구 취향으로 단정하지 않는다.</b>"
 *
 * <p>그래서 {@code sessionStorage} 다. {@code localStorage} 에 두면 그 자체로 영구 취향이 된다 —
 * 사용자가 한 번 넘긴 팝업이 몇 달 뒤에도 안 보인다. 아래 시험 중 하나가 그 선택을 못박는다.
 */

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('넘기고 되돌리기', () => {
  it('넘기면 남는다', () => {
    expect(skipPopup(7)).toEqual({ skipped: true, saved: true });
    expect(isSkipped(7)).toBe(true);
  });

  it('넘긴 순서를 지킨다', () => {
    skipPopup(3);
    skipPopup(1);
    skipPopup(2);
    expect(readSkipped()).toEqual([3, 1, 2]);
  });

  it('같은 것을 두 번 넘겨도 하나다', () => {
    skipPopup(5);
    skipPopup(5);
    expect(readSkipped()).toEqual([5]);
  });

  it('되돌리면 빠진다', () => {
    skipPopup(9);
    expect(unskipPopup(9)).toBe(true);
    expect(isSkipped(9)).toBe(false);
  });

  it('넘긴 적 없는 것을 되돌리면 아무 일도 없다', () => {
    // 토글이 아니다 — 되돌리기가 넘기기로 둔갑하면 안 된다(guestWishlist 와 같은 이유).
    expect(unskipPopup(9)).toBe(false);
    expect(readSkipped()).toEqual([]);
  });

  it('clearSkipped 가 전부 비운다', () => {
    skipPopup(1);
    skipPopup(2);
    clearSkipped();
    expect(readSkipped()).toEqual([]);
  });
});

describe('이번 탐색에서만 — sessionStorage 여야 한다', () => {
  it('sessionStorage 에 쓴다', () => {
    skipPopup(4);
    expect(window.sessionStorage.getItem(DISCOVER_SKIP_KEY)).toBe('[4]');
  });

  it('localStorage 는 건드리지 않는다', () => {
    // localStorage 에 두면 넘기기가 영구 취향이 된다 — 기획이 금지한 바로 그것이다.
    skipPopup(4);
    expect(window.localStorage.getItem(DISCOVER_SKIP_KEY)).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('세션이 비워지면 넘긴 것도 사라진다', () => {
    skipPopup(4);
    window.sessionStorage.clear(); // 탭을 닫은 것과 같다
    expect(readSkipped()).toEqual([]);
  });
});

describe('상한 — 넘기기는 오래된 것부터 버린다', () => {
  it(`${DISCOVER_SKIP_MAX}개를 넘으면 가장 오래된 것이 빠진다`, () => {
    // 비교(compareSelection)는 상한에서 <b>거절</b>한다 — 거기서 오래된 것을 버리면 사용자가
    // 고른 것이 소리 없이 사라지기 때문이다. 넘기기는 반대다. 오래된 넘김이 빠지면 그 팝업이
    // 다시 보일 뿐이고, 그건 손실이 아니라 원래 상태다. 그래서 거절하지 않고 버린다.
    for (let i = 1; i <= DISCOVER_SKIP_MAX + 2; i++) skipPopup(i);
    const kept = readSkipped();
    expect(kept).toHaveLength(DISCOVER_SKIP_MAX);
    expect(kept[0]).toBe(3); // 1·2 가 밀려났다
    expect(kept.at(-1)).toBe(DISCOVER_SKIP_MAX + 2);
  });

  it('상한을 넘겨도 거절하지 않는다', () => {
    for (let i = 1; i <= DISCOVER_SKIP_MAX; i++) skipPopup(i);
    expect(skipPopup(9999)).toEqual({ skipped: true, saved: true });
    expect(isSkipped(9999)).toBe(true);
  });
});

describe('손상값을 흡수한다', () => {
  it.each([
    ['JSON 이 아님', 'not-json'],
    ['배열이 아님', '{"a":1}'],
    ['null', 'null'],
  ])('%s 이면 빈 목록이다', (_label, raw) => {
    window.sessionStorage.setItem(DISCOVER_SKIP_KEY, raw);
    expect(readSkipped()).toEqual([]);
  });

  it('숫자가 아닌 원소·0·음수·소수를 걸러낸다', () => {
    window.sessionStorage.setItem(DISCOVER_SKIP_KEY, JSON.stringify(['7', 0, -1, 1.5, null, 12]));
    expect(readSkipped()).toEqual([12]);
  });

  it('중복이 들어 있으면 하나만 남긴다', () => {
    window.sessionStorage.setItem(DISCOVER_SKIP_KEY, JSON.stringify([4, 4, 5]));
    expect(readSkipped()).toEqual([4, 5]);
  });
});

describe('저장 실패를 숨기지 않는다', () => {
  it('저장소가 막혀 있으면 saved:false 를 준다', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(skipPopup(3)).toEqual({ skipped: true, saved: false });
    setItem.mockRestore();
  });

  it('저장소가 막혀도 던지지 않는다', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => readSkipped()).not.toThrow();
    expect(readSkipped()).toEqual([]);
    getItem.mockRestore();
  });
});

describe('useSyncExternalStore 안전 — 참조 캐싱', () => {
  it('내용이 같으면 같은 배열 참조를 준다', () => {
    skipPopup(1);
    expect(getSkipSnapshot()).toBe(getSkipSnapshot());
  });

  it('내용이 바뀌면 다른 참조를 준다', () => {
    skipPopup(1);
    const before = getSkipSnapshot();
    skipPopup(2);
    expect(getSkipSnapshot()).not.toBe(before);
  });
});
