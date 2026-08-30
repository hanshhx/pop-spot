import { describe, expect, it } from 'vitest';

import { walkMinutes } from './routing';
import { walkInfo } from './walkGroups';

describe('walkMinutes', () => {
  /* 공개 OSRM 서버가 준 duration 을 쓰면 779m 가 2분으로 나온다(시속 22.8km — 자동차 속도).
     실측으로 확인한 값이고, 이 테스트가 그 함정으로 되돌아가는 것을 막는다. */
  it('779m 를 자동차 시간(2분)이 아니라 도보 시간으로 센다', () => {
    expect(walkMinutes(779)).toBe(12);
  });

  it('아주 짧아도 0분이라고 하지 않는다', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(10)).toBe(1);
  });

  it('거리가 늘면 시간도 는다', () => {
    expect(walkMinutes(1000)).toBeGreaterThan(walkMinutes(500));
  });

  /**
   * {@code walkInfo} 와 같은 속도를 쓰는지 확인한다.
   *
   * <p>{@code walkInfo} 는 직선거리에 1.3배를 곱한 뒤 나누므로, 같은 값을 넣으려면 여기에도
   * 1.3배 한 거리를 준다. 두 결과가 같아야 목록의 "도보 7분" 과 길찾기의 분이 어긋나지 않는다.
   */
  it('목록이 쓰는 walkInfo 와 같은 속도를 쓴다', () => {
    /* 성수역에서 위도 0.009도(약 1km) 떨어진 점. */
    const info = walkInfo(37.5445, 127.0557, 37.5535, 127.0557);
    const straightM = 1000 * (37.5535 - 37.5445) * 111.19;
    expect(walkMinutes(straightM * 1.3)).toBe(info.time);
  });
});
