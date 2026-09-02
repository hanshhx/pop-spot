import { describe, expect, it } from 'vitest';

import {
  bumpDropped,
  countsAsDrop,
  DROPPED_KEY,
  MAX_DROPPED,
  readDropped,
  settleDropped,
} from './beaconDrops';

/**
 * 이 계수기가 틀리면 <b>고장이 다시 조용해진다.</b>
 *
 * <p>없는 손실을 지어내면 멀쩡한 구간을 장애로 의심하게 되고, 있는 손실을 흘리면 8월 중순처럼
 * 기록이 통째로 빈 구간이 또 아무 신호 없이 지나간다. 판단이 안 서는 상황은 전부 <b>0</b> 쪽으로
 * 기울되, 세어 둔 것은 절대 잃지 않는다.
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

describe('readDropped', () => {
  it('세어 둔 수를 읽는다', () => {
    expect(readDropped(fakeStorage({ [DROPPED_KEY]: '7' }))).toBe(7);
  });

  it('아무것도 없으면 0', () => {
    expect(readDropped(fakeStorage())).toBe(0);
  });

  /* 없는 손실을 지어내면 멀쩡한 구간을 장애로 의심하게 된다. */
  it.each(['', 'abc', '-3', '0', 'NaN', '1e9999'])('값이 이상하면(%s) 0 으로 본다', (raw) => {
    expect(readDropped(fakeStorage({ [DROPPED_KEY]: raw }))).toBe(0);
  });

  it('상한을 넘겨 읽지 않는다', () => {
    expect(readDropped(fakeStorage({ [DROPPED_KEY]: '99999999' }))).toBe(MAX_DROPPED);
  });

  it('저장소를 못 읽어도 터지지 않는다', () => {
    const 막힌저장소 = {
      getItem: () => {
        throw new Error('접근 거부');
      },
    };

    expect(readDropped(막힌저장소)).toBe(0);
    expect(readDropped(null)).toBe(0);
    expect(readDropped(undefined)).toBe(0);
  });
});

describe('bumpDropped', () => {
  it('한 건씩 늘어난다', () => {
    const s = fakeStorage();

    bumpDropped(s);
    bumpDropped(s);

    expect(readDropped(s)).toBe(2);
  });

  /*
   * 오래 열어 둔 탭에서 값이 끝없이 자라면 안 된다.
   *
   * 읽은 값이 아니라 <b>저장된 값</b>을 본다. readDropped 도 상한을 걸기 때문에 읽은 값만
   * 확인하면 쓰기 쪽 상한이 사라져도 검사가 통과한다 — 이중 방어가 결함을 가려 준다.
   */
  it('상한에서 멈춘다 — 저장되는 값 자체가', () => {
    const s = fakeStorage({ [DROPPED_KEY]: String(MAX_DROPPED) });

    bumpDropped(s);

    expect(s.box[DROPPED_KEY]).toBe(String(MAX_DROPPED));
    expect(readDropped(s)).toBe(MAX_DROPPED);
  });

  it('쓸 수 없는 저장소에서도 터지지 않는다', () => {
    const 막힌저장소 = {
      getItem: () => null,
      setItem: () => {
        throw new Error('용량 초과');
      },
      removeItem: () => {},
    };

    expect(() => bumpDropped(막힌저장소)).not.toThrow();
  });
});

describe('settleDropped', () => {
  it('서버가 받아 준 만큼 빠진다', () => {
    const s = fakeStorage({ [DROPPED_KEY]: '5' });

    settleDropped(s, 5);

    expect(readDropped(s)).toBe(0);
    expect(s.box[DROPPED_KEY]).toBeUndefined();
  });

  /*
   * 이 검사가 이 파일의 핵심이다. 보고를 보낸 뒤 응답이 오기까지 사이에 또 실패할 수 있고,
   * 그때 통째로 지우면 손실을 세는 장치가 손실을 잃는다.
   */
  it('보고한 만큼만 뺀다 — 그 사이에 생긴 손실은 남긴다', () => {
    const s = fakeStorage({ [DROPPED_KEY]: '5' });

    /* 5건을 보고하는 사이에 2건이 더 실패했다 */
    bumpDropped(s);
    bumpDropped(s);
    settleDropped(s, 5);

    expect(readDropped(s)).toBe(2);
  });

  it('음수로 내려가지 않는다', () => {
    const s = fakeStorage({ [DROPPED_KEY]: '2' });

    settleDropped(s, 10);

    expect(readDropped(s)).toBe(0);
  });

  it('보고할 것이 없으면 아무 일도 안 일어난다', () => {
    const s = fakeStorage();

    settleDropped(s, 0);

    expect(readDropped(s)).toBe(0);
  });

  it('저장소가 막혀 있어도 터지지 않는다', () => {
    const 막힌저장소 = {
      getItem: () => '3',
      setItem: () => {
        throw new Error('용량 초과');
      },
      removeItem: () => {
        throw new Error('접근 거부');
      },
    };

    expect(() => settleDropped(막힌저장소, 1)).not.toThrow();
    expect(() => settleDropped(막힌저장소, 3)).not.toThrow();
  });
});

/**
 * 배포 직후 운영에서 바로 오탐이 나왔다 — 응답 204 에 {@code net::ERR_ABORTED}. 서버는 받았는데
 * 화면이 잃었다고 센 것이다. 손실을 세는 장치가 <b>없는 손실을 지어내면</b> 멀쩡한 구간을
 * 장애로 의심하게 되므로, 그쪽이 흘리는 것보다 위험하다.
 */
describe('countsAsDrop', () => {
  it('보통 실패는 센다', () => {
    expect(countsAsDrop(new Error('offline'), false)).toBe(true);
  });

  /* 이 두 개가 이 함수의 존재 이유다. */
  it('페이지가 떠나는 중이면 안 센다 — keepalive 는 그래도 전송된다', () => {
    expect(countsAsDrop(new Error('offline'), true)).toBe(false);
  });

  it('중단된 요청은 안 센다', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });

    expect(countsAsDrop(abort, false)).toBe(false);
  });

  it('오류가 아닌 것이 와도 터지지 않는다', () => {
    expect(countsAsDrop(null, false)).toBe(true);
    expect(countsAsDrop(undefined, false)).toBe(true);
    expect(countsAsDrop('문자열', false)).toBe(true);
    expect(countsAsDrop(null, true)).toBe(false);
  });
});
