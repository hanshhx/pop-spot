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
