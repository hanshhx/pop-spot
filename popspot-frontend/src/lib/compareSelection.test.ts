// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPARE_MAX,
  COMPARE_SELECTION_KEY,
  clearCompareSelection,
  forgetCompareSelection,
  getCompareSnapshot,
  isCompared,
  readCompareSelection,
  removeCompareSelection,
  toggleCompareSelection,
} from './compareSelection';

/**
 * 비교 선택은 <b>찜 위에 얹힌 상태</b>다. 저장소를 새로 만든 것이 아니라, 이미 담아 둔 것 중
 * 지금 나란히 볼 셋을 고른 것이다.
 *
 * <p>아래 시험이 지키는 것은 두 가지다. 하나는 {@code guestWishlist} 와 같은 것 — 잃지 않기,
 * 손상값에 안 죽기, 저장 실패를 숨기지 않기. 다른 하나는 <b>일부러 다르게 한 것</b> — 상한을
 * 넘겼을 때 오래된 것을 말없이 버리지 않고 거절한다.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe('고르고 빼기', () => {
  it('고르면 남고, 다시 누르면 빠진다', () => {
    expect(toggleCompareSelection(7)).toEqual({ selected: true, saved: true });
    expect(isCompared(7)).toBe(true);
    expect(toggleCompareSelection(7)).toEqual({ selected: false, saved: true });
    expect(isCompared(7)).toBe(false);
  });

  it('고른 순서를 지킨다', () => {
    toggleCompareSelection(3);
    toggleCompareSelection(1);
    toggleCompareSelection(2);
    expect(readCompareSelection()).toEqual([3, 1, 2]);
  });

  it('빈 저장소에서는 빈 목록이다', () => {
    expect(readCompareSelection()).toEqual([]);
  });

  it('removeCompareSelection 은 없는 것을 담지 않는다', () => {
    // 토글로 대신하면 "빼기" 가 "담기" 로 둔갑한다. guestWishlist 가 같은 이유로 둘을 나눴다.
    expect(removeCompareSelection(9)).toBe(false);
    expect(readCompareSelection()).toEqual([]);

    toggleCompareSelection(9);
    expect(removeCompareSelection(9)).toBe(true);
    expect(readCompareSelection()).toEqual([]);
  });

  it('clearCompareSelection 이 전부 비운다', () => {
    toggleCompareSelection(1);
    toggleCompareSelection(2);
    clearCompareSelection();
    expect(readCompareSelection()).toEqual([]);
  });
});

describe('상한 — 버리지 않고 거절한다', () => {
  it(`${COMPARE_MAX}개가 차면 그다음은 거절된다`, () => {
    toggleCompareSelection(1);
    toggleCompareSelection(2);
    toggleCompareSelection(3);

    const rejected = toggleCompareSelection(4);

    expect(rejected).toEqual({ selected: false, saved: false, reason: 'full' });
  });

  it('거절돼도 먼저 고른 셋이 그대로 남는다', () => {
    // guestWishlist 는 .slice(-MAX) 로 가장 오래된 것을 말없이 버린다. 상한이 100 이라 겪을 일이
    // 드물어서다. 비교는 상한이 3 이라 매일 겪는다 — 1번이 조용히 사라지면 사용자는 자기가
    // 고른 것이 없어진 이유를 알 수 없다. 이 시험이 그 차이를 못박는다.
    toggleCompareSelection(1);
    toggleCompareSelection(2);
    toggleCompareSelection(3);
    toggleCompareSelection(4);

    expect(readCompareSelection()).toEqual([1, 2, 3]);
    expect(isCompared(4)).toBe(false);
  });

  it('가득 찬 상태에서도 이미 고른 것은 뺄 수 있다', () => {
    // 상한 검사가 해제 경로까지 막으면 사용자가 갇힌다.
    toggleCompareSelection(1);
    toggleCompareSelection(2);
    toggleCompareSelection(3);

    expect(toggleCompareSelection(2)).toEqual({ selected: false, saved: true });
    expect(readCompareSelection()).toEqual([1, 3]);
  });

  it('하나를 빼면 다시 고를 수 있다', () => {
    toggleCompareSelection(1);
    toggleCompareSelection(2);
    toggleCompareSelection(3);
    toggleCompareSelection(1); // 해제
    expect(toggleCompareSelection(4)).toEqual({ selected: true, saved: true });
    expect(readCompareSelection()).toEqual([2, 3, 4]);
  });
});

describe('손상값을 흡수한다', () => {
  it.each([
    ['JSON 이 아님', 'not-json'],
    ['배열이 아님', '{"a":1}'],
    ['null', 'null'],
    ['빈 문자열', ''],
  ])('%s 이면 빈 목록이다', (_label, raw) => {
    window.localStorage.setItem(COMPARE_SELECTION_KEY, raw);
    expect(readCompareSelection()).toEqual([]);
  });

  it('숫자가 아닌 원소·0·음수·소수를 걸러낸다', () => {
    window.localStorage.setItem(
      COMPARE_SELECTION_KEY,
      JSON.stringify(['7', 0, -1, 1.5, null, 12, {}]),
    );
    expect(readCompareSelection()).toEqual([12]);
  });

  it('저장소에 상한을 넘는 값이 들어 있어도 앞에서 잘라 읽는다', () => {
    // 남이 넣었거나 예전 형식일 수 있다. 읽는 쪽이 상한을 지킨다.
    window.localStorage.setItem(COMPARE_SELECTION_KEY, JSON.stringify([1, 2, 3, 4, 5]));
    expect(readCompareSelection()).toEqual([1, 2, 3]);
  });

  it('중복이 들어 있으면 하나만 남긴다', () => {
    window.localStorage.setItem(COMPARE_SELECTION_KEY, JSON.stringify([4, 4, 5]));
    expect(readCompareSelection()).toEqual([4, 5]);
  });
});

describe('저장 실패를 숨기지 않는다', () => {
  it('저장소가 막혀 있으면 saved:false 를 준다', () => {
    // 시크릿 창·사이트 데이터 차단·용량 초과. 화면이 "고름" 이라고 말하면 새로고침에서 잃는다.
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((): undefined => undefined);
    setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(toggleCompareSelection(3)).toEqual({ selected: true, saved: false });

    setItem.mockRestore();
  });

  it('저장소가 막혀도 던지지 않는다', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => readCompareSelection()).not.toThrow();
    expect(readCompareSelection()).toEqual([]);

    getItem.mockRestore();
  });
});

describe('찜 해제 연동 — forgetCompareSelection', () => {
  it('지정한 id 만 뺀다', () => {
    toggleCompareSelection(1);
    toggleCompareSelection(2);
    expect(forgetCompareSelection([1])).toBe(1);
    expect(readCompareSelection()).toEqual([2]);
  });

  it('없는 id 는 0 을 준다', () => {
    toggleCompareSelection(1);
    expect(forgetCompareSelection([9])).toBe(0);
    expect(readCompareSelection()).toEqual([1]);
  });

  it('빈 배열이면 저장소를 건드리지 않는다', () => {
    toggleCompareSelection(1);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    expect(forgetCompareSelection([])).toBe(0);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('호출 시점에 저장소를 다시 읽는다', () => {
    // guestWishlist.forgetGuestWishlist 와 같은 이유. 미리 읽어 둔 배열을 되쓰면 그 사이에
    // 사용자가 고른 것이 조용히 지워진다.
    toggleCompareSelection(1);
    window.localStorage.setItem(COMPARE_SELECTION_KEY, JSON.stringify([1, 2]));
    forgetCompareSelection([1]);
    expect(readCompareSelection()).toEqual([2]);
  });
});

describe('useSyncExternalStore 안전 — 참조 캐싱', () => {
  it('내용이 같으면 같은 배열 참조를 준다', () => {
    // 선례(externalMediaConsent)는 boolean 이라 문제가 없었다. 배열을 매번 새로 만들어 돌려주면
    // React 가 스냅샷이 계속 바뀐다고 보고 무한 렌더에 빠진다.
    toggleCompareSelection(1);
    expect(getCompareSnapshot()).toBe(getCompareSnapshot());
  });

  it('내용이 바뀌면 다른 참조를 준다', () => {
    toggleCompareSelection(1);
    const before = getCompareSnapshot();
    toggleCompareSelection(2);
    expect(getCompareSnapshot()).not.toBe(before);
    expect(getCompareSnapshot()).toEqual([1, 2]);
  });

  it('다른 탭이 바꿔도 새 참조를 준다', () => {
    toggleCompareSelection(1);
    const before = getCompareSnapshot();
    window.localStorage.setItem(COMPARE_SELECTION_KEY, JSON.stringify([1, 2]));
    expect(getCompareSnapshot()).not.toBe(before);
  });
});
