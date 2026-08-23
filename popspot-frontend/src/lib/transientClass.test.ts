import { describe, expect, it } from 'vitest';

import { parseCssDuration, FALLBACK_MS } from './transientClass';

describe('parseCssDuration', () => {
  it('ms 와 s 를 모두 밀리초로 읽는다', () => {
    expect(parseCssDuration('320ms')).toBe(320);
    expect(parseCssDuration('0.32s')).toBe(320);
    expect(parseCssDuration('  1s  ')).toBe(1000);
  });

  it('브라우저가 돌려주는 형태를 읽는다', () => {
    // getComputedStyle 은 적어 둔 그대로 주지 않는다. Chrome 은 "320ms" 를 ".32s" 로 직렬화해
    // 돌려준다 — 앞에 0 이 없는 형태다. 이걸 못 읽으면 조용히 기본값으로 떨어지고, CSS 를
    // 고쳐도 반영되지 않는다.
    expect(parseCssDuration('.32s')).toBe(320);
    expect(parseCssDuration('.5s')).toBe(500);
  });

  it('ms 를 초로 읽지 않는다', () => {
    // 's' 를 먼저 잘라 보면 "320ms" 가 320초가 되고, 클래스가 5분 넘게 붙어 있게 된다.
    expect(parseCssDuration('320ms')).not.toBe(320_000);
  });

  it('값이 없거나 이상하면 기본값으로 물러선다', () => {
    // 변수를 못 읽으면 getComputedStyle 은 빈 문자열을 준다. 그때 0 을 쓰면 클래스가 즉시
    // 떨어져 전환이 통째로 사라진다 — 고치려던 증상 그대로가 된다.
    for (const bad of ['', '   ', 'fast', '320', 'ms', '-200ms', '0s', 'NaNms']) {
      expect(parseCssDuration(bad), `${JSON.stringify(bad)}`).toBe(FALLBACK_MS);
    }
  });

  it('기본값은 호출한 쪽이 정할 수 있다', () => {
    expect(parseCssDuration('', 500)).toBe(500);
  });
});
