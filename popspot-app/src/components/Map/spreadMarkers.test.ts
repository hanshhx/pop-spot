import { describe, expect, it } from 'vitest';

import { FALLBACK_CLUSTER_MIN } from '@/lib/fallbackCoords';
import { spreadOverlappingMarkers } from './spreadMarkers';

const pin = (id: number, latitude: string | null, longitude: string | null) => ({
  id,
  latitude,
  longitude,
});
const stack = (n: number, lat: string, lng: string) =>
  Array.from({ length: n }, (_, i) => pin(i, lat, lng));

describe('spreadOverlappingMarkers', () => {
  it('혼자인 핀은 좌표를 그대로 둔다', () => {
    const out = spreadOverlappingMarkers([pin(1, '37.5443', '127.0557')]);
    expect(out).toEqual([pin(1, '37.5443', '127.0557')]);
  });

  it('같은 좌표에 겹친 핀을 전부 남기되 서로 다른 자리로 흩는다', () => {
    // 이걸 안 하면 다섯 곳이 열려 있어도 지도에는 한 점으로 보인다.
    const out = spreadOverlappingMarkers(stack(5, '37.52', '126.92'));
    expect(out).toHaveLength(5);
    expect(new Set(out.map((m) => `${m.latitude},${m.longitude}`)).size).toBe(5);
  });

  it('흩어 놓은 자리는 원래 좌표에서 약 5m 안이다', () => {
    const out = spreadOverlappingMarkers(stack(4, '37.52', '126.92'));
    for (const m of out) {
      expect(Math.abs(Number(m.latitude) - 37.52)).toBeLessThanOrEqual(0.00005 + 1e-12);
      expect(Math.abs(Number(m.longitude) - 126.92)).toBeLessThanOrEqual(0.00005 + 1e-12);
    }
  });

  it('문턱을 넘긴 무리는 흩지 않고 통째로 뺀다', () => {
    // 지오코딩이 실패해 동네 한가운데로 찍힌 값. 흩으면 없는 자리에 수백 개를 뿌리게 된다.
    const out = spreadOverlappingMarkers([
      ...stack(FALLBACK_CLUSTER_MIN + 1, '37.55', '126.99'),
      pin(999, '37.5443', '127.0557'),
    ]);
    expect(out).toEqual([pin(999, '37.5443', '127.0557')]);
  });

  it('정확히 문턱이면 아직 남긴다 — 초과여야 뺀다', () => {
    const out = spreadOverlappingMarkers(stack(FALLBACK_CLUSTER_MIN, '37.55', '126.99'));
    expect(out).toHaveLength(FALLBACK_CLUSTER_MIN);
  });

  it('좌표가 없는 핀은 조용히 빠진다', () => {
    const out = spreadOverlappingMarkers([pin(1, null, null), pin(2, '37.5', '127.0')]);
    expect(out.map((m) => m.id)).toEqual([2]);
  });

  it('원본 객체를 고치지 않는다', () => {
    const input = stack(3, '37.52', '126.92');
    spreadOverlappingMarkers(input);
    expect(input.every((m) => m.latitude === '37.52')).toBe(true);
  });
});
