import { describe, expect, it } from 'vitest';

import { nearestStation } from './nearestStation';

describe('nearestStation', () => {
  it('성수동 좌표에서는 성수역을 찾는다', () => {
    const got = nearestStation(37.5447, 127.0557);
    expect(got?.name).toContain('성수');
  });

  it('강남 좌표에서는 성수역을 찾지 않는다 — 최근접이지 고정값이 아니다', () => {
    const got = nearestStation(37.4979, 127.0276);
    expect(got?.name).not.toContain('성수');
  });

  it('도보 기준을 넘으면 null 이다 — 30분 걸리는 역은 가는 법이 아니다', () => {
    // 서울 경계 밖(김포 방면). 가까운 역이 없다.
    expect(nearestStation(37.62, 126.6, 15)).toBeNull();
  });

  it('좌표가 유한하지 않으면 null 이다', () => {
    expect(nearestStation(NaN, 127.0)).toBeNull();
  });
});
