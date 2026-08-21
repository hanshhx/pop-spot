import { describe, expect, it } from 'vitest';

import type { PublicMapMarker } from '@/lib/mapMarkers';
import {
  NEARBY_RADIUS_KM,
  distanceKm,
  findNearby,
  looksLikeSameEvent,
  positionOf,
  walkingMinutes,
} from './nearbyPopups';

/** 성수역. 아래 좌표는 전부 여기 기준이다. */
const SEONGSU = { lat: 37.5445, lng: 127.056 };

function marker(over: Partial<PublicMapMarker> & { id: number }): PublicMapMarker {
  return {
    name: `팝업 ${over.id}`,
    location: '서울 성동구',
    latitude: String(SEONGSU.lat),
    longitude: String(SEONGSU.lng),
    category: 'ETC',
    startDate: null,
    endDate: null,
    ...over,
  };
}

describe('distanceKm', () => {
  it('같은 자리는 0', () => {
    expect(distanceKm(SEONGSU.lat, SEONGSU.lng, SEONGSU.lat, SEONGSU.lng)).toBe(0);
  });

  it('위도 1도는 약 111km', () => {
    expect(distanceKm(37, 127, 38, 127)).toBeCloseTo(111.19, 1);
  });

  it('서울 위도에서 경도 1도는 위도 1도보다 짧다', () => {
    // 평면으로 계산하면 이 둘이 같아진다. 그러면 동서 거리가 실제보다 부풀려진다.
    const ns = distanceKm(37.5, 127, 38.5, 127);
    const ew = distanceKm(37.5, 127, 37.5, 128);
    expect(ew).toBeLessThan(ns);
    expect(ew).toBeCloseTo(88.2, 0);
  });
});

describe('positionOf', () => {
  // findNearby 를 통해서는 이 규칙을 확인할 수 없다. 없는 값을 0 으로 메워도 서울에서는
  // 결과가 같기 때문이다 — 적도 근처로 밀려나 어차피 반경 밖이 된다. 실제로 그렇게 바꿔 보고
  // 시험이 전부 통과하는 것을 확인했다. 그래서 계약을 여기서 직접 본다.

  it('둘 다 있어야 좌표로 친다', () => {
    expect(positionOf(marker({ id: 1 }))).toEqual({ lat: SEONGSU.lat, lng: SEONGSU.lng });
  });

  it('한쪽이 없으면 null — 0 으로 메우지 않는다', () => {
    // 0 으로 메우는 코드는 "이 팝업은 (0, 127) 에 있다" 고 말한다. 지금은 거리 필터가 우연히
    // 가려 주지만, 이 함수를 지도 핀이나 정렬에 쓰는 순간 그 거짓말이 화면에 나온다.
    expect(positionOf(marker({ id: 1, longitude: null }))).toBeNull();
    expect(positionOf(marker({ id: 1, latitude: null }))).toBeNull();
  });

  it('빈 문자열도 없는 것으로 친다', () => {
    // Number('') 는 0 이다. 빈 칸이 적도로 둔갑하는 가장 흔한 경로.
    expect(positionOf(marker({ id: 1, latitude: '' }))).toBeNull();
  });

  it('숫자가 아니면 null', () => {
    expect(positionOf(marker({ id: 1, latitude: '알 수 없음' }))).toBeNull();
  });
});

describe('findNearby', () => {
  it('자기 자신은 빼고 가까운 순으로 준다', () => {
    const markers = [
      marker({ id: 1 }), // 원점 = 지금 보는 팝업
      marker({ id: 2, latitude: '37.5490' }), // 약 0.5km
      marker({ id: 3, latitude: '37.5460' }), // 약 0.17km
    ];
    const got = findNearby(SEONGSU, markers, { excludeId: 1 });
    expect(got.map((n) => n.marker.id)).toEqual([3, 2]);
  });

  it('걸어갈 수 없는 거리는 뺀다', () => {
    // 강남(약 5km). 목록을 채우려고 이런 걸 넣으면 "근처" 가 거짓말이 된다.
    const far = marker({ id: 9, latitude: '37.4979', longitude: '127.0276' });
    expect(findNearby(SEONGSU, [far], { excludeId: 1 })).toEqual([]);
    expect(distanceKm(SEONGSU.lat, SEONGSU.lng, 37.4979, 127.0276)).toBeGreaterThan(
      NEARBY_RADIUS_KM,
    );
  });

  it('이미 끝난 팝업은 권하지 않는다', () => {
    const ended = marker({ id: 2, latitude: '37.5460', endDate: '2026-08-01' });
    const open = marker({ id: 3, latitude: '37.5460', endDate: '2026-12-31' });
    const got = findNearby(SEONGSU, [ended, open], { excludeId: 1, today: '2026-08-22' });
    expect(got.map((n) => n.marker.id)).toEqual([3]);
  });

  it('오늘 마감하는 팝업은 남긴다', () => {
    // 마감일 당일은 아직 문이 열려 있다. `<` 가 아니라 `<=` 로 자르면 오늘 것이 사라진다.
    const closingToday = marker({ id: 4, latitude: '37.5460', endDate: '2026-08-22' });
    const got = findNearby(SEONGSU, [closingToday], { excludeId: 1, today: '2026-08-22' });
    expect(got).toHaveLength(1);
  });

  it('좌표가 반쪽이면 목록에 넣지 않는다', () => {
    const half = marker({ id: 2, latitude: '37.5460', longitude: null });
    expect(findNearby(SEONGSU, [half], { excludeId: 1 })).toEqual([]);
  });

  it('원점 좌표가 없으면 아무것도 권하지 않는다', () => {
    const ok = marker({ id: 2, latitude: '37.5460' });
    expect(findNearby({ lat: NaN, lng: NaN }, [ok], { excludeId: 1 })).toEqual([]);
  });

  it('세 개까지만 준다', () => {
    const many = [2, 3, 4, 5, 6].map((id) => marker({ id, latitude: '37.5450' }));
    expect(findNearby(SEONGSU, many, { excludeId: 1 })).toHaveLength(3);
  });

  it('없으면 빈 배열 — 억지로 채우지 않는다', () => {
    expect(findNearby(SEONGSU, [], { excludeId: 1 })).toEqual([]);
  });

  it('같은 행사가 다른 id 로 또 있으면 뺀다', () => {
    // 실제로 화면에서 본 경우다. 2991번을 보는데 1890번이 "167m" 로 떠 있었고 둘은 같은 행사였다.
    const dupe = marker({
      id: 1890,
      name: '스트릿 레스토랑 파이터 셰프 릴레이 팝업',
      latitude: '37.5460',
    });
    const other = marker({ id: 2888, name: '그랜드롯데 서울', latitude: '37.5460' });
    const got = findNearby(SEONGSU, [dupe, other], {
      excludeId: 2991,
      excludeName: '스트릿 레스토랑 파이터 셰프 릴레이 팝업스토어',
    });
    expect(got.map((n) => n.marker.id)).toEqual([2888]);
  });
});

describe('looksLikeSameEvent', () => {
  it('뒤에 말이 더 붙은 같은 이름을 잡는다', () => {
    expect(
      looksLikeSameEvent('스트릿 레스토랑 파이터 셰프 릴레이 팝업', '스트릿 레스토랑 파이터 셰프 릴레이 팝업스토어'),
    ).toBe(true);
  });

  it('공백과 기호만 다른 이름을 잡는다', () => {
    expect(looksLikeSameEvent('블랭킷 도넛 코리아', '블랭킷도넛코리아')).toBe(true);
    expect(looksLikeSameEvent('POP-UP · 나이키 서울', 'popup 나이키 서울')).toBe(true);
  });

  it('서로 다른 팝업은 그냥 둔다', () => {
    expect(looksLikeSameEvent('블랭킷도넛 코리아', '그랜드롯데 서울')).toBe(false);
  });

  it('짧은 이름은 품고 있어도 같다고 하지 않는다', () => {
    // '팝업' 이 다른 이름 안에 들어 있다고 같은 행사는 아니다.
    expect(looksLikeSameEvent('팝업', '나이키 팝업스토어')).toBe(false);
    expect(looksLikeSameEvent('젠틀몬스터', '젠틀몬스터')).toBe(true);
  });

  it('빈 이름은 아무것과도 같지 않다', () => {
    expect(looksLikeSameEvent('', '나이키 팝업스토어')).toBe(false);
  });
});

describe('walkingMinutes', () => {
  it('아주 가까워도 0분이라고 하지 않는다', () => {
    // "도보 0분" 은 정보가 아니다.
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(0.01)).toBe(1);
  });

  it('1km 는 15분쯤', () => {
    expect(walkingMinutes(1)).toBe(15);
  });
});
