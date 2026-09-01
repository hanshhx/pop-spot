import { describe, expect, it } from 'vitest';

import {
  isOptedOut,
  OPT_OUT_KEY,
  optOutFromSearch,
  resolveOptOut,
  setOptOut,
} from './analyticsOptOut';

/**
 * 이 판정이 느슨하면 내 방문이 계속 섞여 <b>어떤 날이 진짜 좋았는지</b>를 못 본다. 빡빡하면
 * 진짜 방문자가 빠져 숫자가 실제보다 적게 나온다 — 그쪽이 더 위험하다. 판단이 안 서는 상황은
 * 전부 <b>집계하는 쪽</b>으로 기운다.
 */

function fakeStorage(initial: Record<string, string> = {}) {
  const box = { ...initial };
  return {
    getItem: (k: string) => box[k] ?? null,
    setItem: (k: string, v: string) => {
      box[k] = v;
    },
    removeItem: (k: string) => {
      delete box[k];
    },
    box,
  };
}

describe('optOutFromSearch', () => {
  it.each(['?ignore-analytics=1', '?ignore-analytics=true', '?ignore-analytics'])(
    '%s 는 켜라는 뜻이다',
    (search) => {
      expect(optOutFromSearch(search)).toBe(true);
    },
  );

  /* 한 번 켜 두면 끄는 길도 있어야 한다. 없으면 그 기기는 영영 집계에서 빠진다. */
  it.each(['?ignore-analytics=0', '?ignore-analytics=false', '?ignore-analytics=off'])(
    '%s 는 끄라는 뜻이다',
    (search) => {
      expect(optOutFromSearch(search)).toBe(false);
    },
  );

  it('아무 말이 없으면 건드리지 않는다', () => {
    expect(optOutFromSearch('')).toBeNull();
    expect(optOutFromSearch('?from=search&tab=map')).toBeNull();
  });

  /* 다른 파라미터와 섞여 있어도 찾아야 한다 — 공유 링크에는 늘 뭔가 붙어 있다. */
  it('다른 파라미터와 섞여 있어도 읽는다', () => {
    expect(optOutFromSearch('?from=kakao&ignore-analytics=1&utm_source=x')).toBe(true);
  });
});

describe('isOptedOut', () => {
  it('표시가 있으면 뺀다', () => {
    expect(isOptedOut(fakeStorage({ [OPT_OUT_KEY]: '1' }))).toBe(true);
  });

  it('표시가 없으면 집계한다', () => {
    expect(isOptedOut(fakeStorage())).toBe(false);
  });

  /*
   * 사생활 보호 모드처럼 저장소 접근 자체가 예외를 던지는 곳이 있다. 거기서 "빠진다" 로 기울면
   * 그 브라우저의 진짜 방문자가 통째로 사라진다. 판단이 안 서면 집계한다.
   */
  it('저장소를 못 읽으면 집계한다', () => {
    const 막힌저장소 = {
      getItem: () => {
        throw new Error('접근 거부');
      },
    };

    expect(isOptedOut(막힌저장소)).toBe(false);
    expect(isOptedOut(null)).toBe(false);
    expect(isOptedOut(undefined)).toBe(false);
  });
});

describe('resolveOptOut', () => {
  it('주소로 켜면 저장되고, 그 뒤로는 주소가 없어도 빠진다', () => {
    const s = fakeStorage();

    expect(resolveOptOut(s, '?ignore-analytics=1')).toBe(true);
    expect(s.box[OPT_OUT_KEY]).toBe('1');
    /* 다음 방문 — 주소에 아무것도 없다 */
    expect(resolveOptOut(s, '')).toBe(true);
  });

  it('주소로 끄면 표시가 지워진다', () => {
    const s = fakeStorage({ [OPT_OUT_KEY]: '1' });

    expect(resolveOptOut(s, '?ignore-analytics=0')).toBe(false);
    expect(s.box[OPT_OUT_KEY]).toBeUndefined();
    expect(resolveOptOut(s, '')).toBe(false);
  });

  it('저장소가 없어도 터지지 않는다', () => {
    expect(resolveOptOut(null, '?ignore-analytics=1')).toBe(false);
  });
});

describe('setOptOut', () => {
  it('쓸 수 없는 저장소에서도 터지지 않는다', () => {
    const 막힌저장소 = {
      getItem: () => null,
      setItem: () => {
        throw new Error('용량 초과');
      },
      removeItem: () => {
        throw new Error('접근 거부');
      },
    };

    expect(() => setOptOut(막힌저장소, true)).not.toThrow();
    expect(() => setOptOut(막힌저장소, false)).not.toThrow();
  });
});
