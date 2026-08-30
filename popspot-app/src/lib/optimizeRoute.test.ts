import { describe, expect, it } from 'vitest';

import { minutesOfClock, optimizeRoute, totalWalkMinutes, type RouteStop } from './optimizeRoute';

/* 성수역 3번 출구 언저리. 값 자체는 중요하지 않고, 아래 좌표들이 여기서 얼마나 떨어져 있는지가
   중요하다 — 위도 0.001 이 약 111m 라 도보 2분쯤 된다. */
const ORIGIN = { lat: 37.5445, lng: 127.0557 };

function stop(id: number, name: string, latOffset: number, extra: Partial<RouteStop> = {}): RouteStop {
  return { id, name, lat: ORIGIN.lat + latOffset, lng: ORIGIN.lng, ...extra };
}

const NEAR = stop(1, '가까운 곳', 0.002);
const MID = stop(2, '중간', 0.006);
const FAR = stop(3, '먼 곳', 0.012);

describe('minutesOfClock', () => {
  it('시각을 분으로 바꾼다', () => {
    expect(minutesOfClock('19:30')).toBe(19 * 60 + 30);
    expect(minutesOfClock('9:00')).toBe(540);
  });

  it('읽을 수 없으면 null — 지어내지 않는다', () => {
    expect(minutesOfClock(null)).toBeNull();
    expect(minutesOfClock('상시')).toBeNull();
    expect(minutesOfClock('25:00')).toBeNull();
    expect(minutesOfClock('19:70')).toBeNull();
  });
});

describe('optimizeRoute', () => {
  const plain = { useCongestion: false, useHours: false };

  it('내 위치에서 가까운 순으로 다시 세운다', () => {
    const result = optimizeRoute(ORIGIN, [FAR, NEAR, MID], plain);
    expect(result.stops.map((s) => s.name)).toEqual(['가까운 곳', '중간', '먼 곳']);
  });

  /* 웹은 목록의 첫 항목을 출발점으로 고정했다. 앱은 내 위치가 출발점이므로, 먼 곳이 목록 맨 앞에
     있어도 그 자리를 지키지 못한다 — 이게 웹과 달라진 유일한 지점이라 못 박아 둔다. */
  it('목록 맨 앞이라고 해서 첫 순서를 지키지 않는다', () => {
    expect(optimizeRoute(ORIGIN, [FAR, NEAR], plain).stops[0].name).toBe('가까운 곳');
  });

  it('아낀 시간은 음수가 되지 않는다', () => {
    const already = optimizeRoute(ORIGIN, [NEAR, MID, FAR], plain);
    expect(already.savedMinutes).toBe(0);
    expect(already.afterMinutes).toBe(already.beforeMinutes);
  });

  it('재배치하면 총 도보가 줄거나 같다', () => {
    const result = optimizeRoute(ORIGIN, [FAR, NEAR, MID], plain);
    expect(result.afterMinutes).toBeLessThanOrEqual(result.beforeMinutes);
    expect(result.savedMinutes).toBe(result.beforeMinutes - result.afterMinutes);
  });

  it('같은 입력은 같은 순서를 낸다', () => {
    const a = optimizeRoute(ORIGIN, [FAR, NEAR, MID], plain);
    const b = optimizeRoute(ORIGIN, [FAR, NEAR, MID], plain);
    expect(a.stops.map((s) => s.id)).toEqual(b.stops.map((s) => s.id));
  });

  it('곳이 하나면 그대로 둔다', () => {
    expect(optimizeRoute(ORIGIN, [NEAR], plain).stops).toEqual([NEAR]);
    expect(optimizeRoute(ORIGIN, [], plain).stops).toEqual([]);
  });

  describe('혼잡도 반영', () => {
    const busyNear = stop(1, '가깝지만 붐빔', 0.002, { waitMinutes: 34 });
    const quietMid = stop(2, '조금 멀지만 한산', 0.006, { waitMinutes: 0 });

    it('끄면 거리만 본다', () => {
      const off = optimizeRoute(ORIGIN, [busyNear, quietMid], plain);
      expect(off.stops[0].name).toBe('가깝지만 붐빔');
    });

    it('켜면 대기 34분인 곳이 뒤로 밀린다', () => {
      const on = optimizeRoute(ORIGIN, [busyNear, quietMid], {
        useCongestion: true,
        useHours: false,
      });
      expect(on.stops[0].name).toBe('조금 멀지만 한산');
    });
  });

  describe('운영시간 반영', () => {
    /* 가까운 곳은 밤까지 열고, 먼 곳은 곧 닫는다. 거리만 보면 가까운 곳이 먼저지만 그러면 먼 곳은
       닫힌 뒤에 도착한다. */
    const lateNear = stop(1, '늦게까지', 0.002, { closesAt: '22:00', stayMinutes: 40 });
    const earlyFar = stop(2, '곧 닫음', 0.01, { closesAt: '19:00', stayMinutes: 40 });
    const at1730 = 17 * 60 + 30;

    it('끄면 가까운 곳이 먼저다', () => {
      const off = optimizeRoute(ORIGIN, [lateNear, earlyFar], {
        ...plain,
        departAtMinutes: at1730,
      });
      expect(off.stops[0].name).toBe('늦게까지');
    });

    it('켜면 먼저 닫는 곳을 앞으로 당긴다', () => {
      const on = optimizeRoute(ORIGIN, [lateNear, earlyFar], {
        useCongestion: false,
        useHours: true,
        departAtMinutes: at1730,
      });
      expect(on.stops[0].name).toBe('곧 닫음');
    });

    /* 마감 시각을 모르는 곳까지 앞으로 당기면, 정보가 없다는 사실이 "급하다"로 둔갑한다. */
    it('마감 시각이 없는 곳은 거리로만 본다', () => {
      const unknown = stop(3, '마감 미상', 0.02);
      const on = optimizeRoute(ORIGIN, [unknown, lateNear], {
        useCongestion: false,
        useHours: true,
        departAtMinutes: at1730,
      });
      expect(on.stops[0].name).toBe('늦게까지');
    });
  });
});

describe('totalWalkMinutes', () => {
  it('출발점부터 순서대로 이어 붙인다', () => {
    expect(totalWalkMinutes(ORIGIN, [])).toBe(0);
    const one = totalWalkMinutes(ORIGIN, [NEAR]);
    const two = totalWalkMinutes(ORIGIN, [NEAR, MID]);
    expect(two).toBeGreaterThan(one);
  });
});
