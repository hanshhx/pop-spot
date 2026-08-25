import { describe, expect, it } from 'vitest';

import type { PublicMapMarker } from './mapMarkers';
import { nearbyWithin } from './nearby';

const pin = (id: number, name: string, lat: string, lng: string): PublicMapMarker => ({
  id,
  name,
  location: null,
  latitude: lat,
  longitude: lng,
  category: null,
  startDate: null,
  endDate: null,
});

// 실측 성수 좌표.
const ANCHOR = { lat: 37.5447, lng: 127.0557 };
const CLOSE = pin(1, '무신사 스토어 성수', '37.5414', '127.0559'); // 약 370m
const MID = pin(2, '성수연방', '37.5436', '127.0561'); // 약 130m
const FAR = pin(3, '홍대 어딘가', '37.5563', '126.9235'); // 약 12km

describe('nearbyWithin', () => {
  it('가까운 순으로 돌려준다', () => {
    const got = nearbyWithin(ANCHOR, [CLOSE, MID], 15, 3);
    expect(got.map((n) => n.marker.id)).toEqual([2, 1]);
  });

  it('도보 시간이 기준을 넘으면 뺀다', () => {
    const got = nearbyWithin(ANCHOR, [MID, FAR], 15, 3);
    expect(got.map((n) => n.marker.id)).toEqual([2]);
  });

  it('limit 만큼만 돌려준다', () => {
    const got = nearbyWithin(ANCHOR, [CLOSE, MID], 15, 1);
    expect(got).toHaveLength(1);
  });

  it('좌표가 없는 마커는 조용히 뺀다 — 거리를 계산할 수 없다', () => {
    const noCoord = pin(4, '좌표 없음', '', '');
    const got = nearbyWithin(ANCHOR, [MID, noCoord], 15, 3);
    expect(got.map((n) => n.marker.id)).toEqual([2]);
  });

  it('앵커 자기 자신은 결과에 넣지 않는다', () => {
    const self = pin(9, '나 자신', '37.5447', '127.0557');
    const got = nearbyWithin(ANCHOR, [self, MID], 15, 3, 9);
    expect(got.map((n) => n.marker.id)).toEqual([2]);
  });

  it('이웃이 하나도 없으면 빈 배열이다', () => {
    expect(nearbyWithin(ANCHOR, [FAR], 15, 3)).toEqual([]);
  });
});

// 실측 사례: /popup/4399(T1 암행천문 팝업스토어) 상세에 좌표가 완전히 같은 다른 id(4150,
// "T1 암행천문")가 "도보 0분" 으로 떴다 — selfId 는 4399 만 잡고 4150 은 못 잡는다. 1,181행
// 피드 전체를 좌표로 묶으면 164그룹 672행(57%)이 이런 중복을 갖고 있어 드문 사례가 아니다.
describe('nearbyWithin — 좌표 중복 방어', () => {
  const REAL_ANCHOR = { lat: 37.5448580004466, lng: 127.050553043931 };
  // 앵커와 좌표가 완전히 같은 다른 id — 같은 자리의 중복 행이다.
  const SAME_SPOT_AS_ANCHOR = pin(4150, 'T1 암행천문', '37.5448580004466', '127.050553043931');
  // 앵커와 좌표가 다른, 진짜 걸어갈 수 있는 이웃(실측 도보 2분).
  const REAL_NEIGHBOR = pin(
    3824,
    '어뮤즈 성수 플래그십 스토어',
    '37.5438137552044',
    '127.050522918312',
  );

  it('앵커와 좌표가 같은 다른 id 는 뺀다 — selfId 로는 못 잡는 중복 행이다', () => {
    const got = nearbyWithin(REAL_ANCHOR, [SAME_SPOT_AS_ANCHOR], 15, 3, 4399);
    expect(got).toEqual([]);
  });

  it('살아남은 이웃끼리 좌표가 겹치면 먼저 들어온 것만 남긴다', () => {
    // 같은 건물의 중복 행 두 개. 앵커와는 다른 좌표라 앵커 중복 규칙에는 안 걸린다.
    const first = pin(101, '먼저 들어온 곳', '37.5436', '127.0561');
    const second = pin(102, '나중 들어온 곳(중복 행)', '37.5436', '127.0561');
    const got = nearbyWithin(ANCHOR, [first, second], 15, 3);
    expect(got.map((n) => n.marker.id)).toEqual([101]);
  });

  it('앵커와 좌표가 다른 진짜 이웃은 그대로 남는다', () => {
    const got = nearbyWithin(REAL_ANCHOR, [SAME_SPOT_AS_ANCHOR, REAL_NEIGHBOR], 15, 3, 4399);
    expect(got.map((n) => n.marker.id)).toEqual([3824]);
  });
});
