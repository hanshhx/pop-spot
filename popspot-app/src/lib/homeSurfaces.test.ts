import { describe, expect, it } from 'vitest';

import type { PopupStore } from '@/types/popup';

import { homeSurfaces } from './homeSurfaces';

/** KST 2026-08-26 자정. 실제로는 kstTodayStart() 가 넘기는 값과 같은 모양이다. */
const TODAY = new Date('2026-08-26T00:00:00+09:00');

const p = (id: number, viewCount: number, startDate: string, endDate: string): PopupStore =>
  ({ id, name: `p${id}`, viewCount, startDate, endDate }) as unknown as PopupStore;

const SIZES = { ranking: 2, closing: 2 };

describe('homeSurfaces', () => {
  it('두 자리가 서로 겹치지 않는다 — 같은 팝업이 두 자리에 나오지 않는다', () => {
    const pool = [
      p(1, 100, '2026-08-01', '2026-08-27'),
      p(2, 90, '2026-08-02', '2026-08-28'),
      p(3, 10, '2026-08-25', '2026-12-31'),
      p(4, 9, '2026-08-24', '2026-12-31'),
      p(5, 1, '2026-01-01', '2026-08-29'),
      p(6, 0, '2026-01-01', '2026-08-30'),
    ];
    const s = homeSurfaces(pool, TODAY, SIZES);
    const ids = [...s.ranking, ...s.closing].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('POP-LOOK 은 인기순 상위를 받는다 — 여기가 유일한 랭킹이다', () => {
    const pool = [
      p(1, 100, '2026-08-01', '2026-12-31'),
      p(2, 90, '2026-08-02', '2026-12-31'),
      p(3, 10, '2026-08-25', '2026-12-31'),
      p(4, 9, '2026-08-24', '2026-12-31'),
    ];
    expect(homeSurfaces(pool, TODAY, SIZES).ranking.map((x) => x.id)).toEqual([1, 2]);
  });

  it('마감 임박은 랭킹이 이미 가져간 것을 빼고 고른다 — 가장 급해도 두 번 쓰지 않는다', () => {
    // 1·2위는 가장 인기 있으면서 동시에 가장 임박한 곳이다 — 랭킹이 먼저 가져가므로
    // 마감 임박 자리는 그다음으로 급한 3·4위를 받아야 한다.
    const pool = [
      p(1, 100, '2026-08-01', '2026-08-27'),
      p(2, 90, '2026-08-02', '2026-08-28'),
      p(3, 10, '2026-08-03', '2026-08-29'),
      p(4, 9, '2026-08-04', '2026-08-30'),
    ];
    const s = homeSurfaces(pool, TODAY, SIZES);
    expect(s.ranking.map((x) => x.id)).toEqual([1, 2]);
    expect(s.closing.map((x) => x.id)).toEqual([3, 4]);
  });

  it('이미 끝난 것은 마감 임박이 아니다', () => {
    // ranking:0 으로 둬 랭킹이 아무것도 가져가지 않게 하고, 마감 임박 판정 자체만 본다.
    const pool = [p(1, 1, '2026-01-01', '2026-08-20'), p(2, 1, '2026-01-01', '2026-08-27')];
    const sizes = { ranking: 0, closing: 2 };
    expect(homeSurfaces(pool, TODAY, sizes).closing.map((x) => x.id)).toEqual([2]);
  });

  it('풀이 모자라면 채우다 만다 — 같은 것을 두 번 넣어 칸을 채우지 않는다', () => {
    const pool = [p(1, 100, '2026-08-25', '2026-12-31'), p(2, 90, '2026-08-24', '2026-12-31')];
    const s = homeSurfaces(pool, TODAY, SIZES);
    expect(s.ranking).toHaveLength(2);
    expect(s.closing).toHaveLength(0);
  });

  it('빈 풀이면 두 자리 모두 빈 배열이다', () => {
    expect(homeSurfaces([], TODAY, SIZES)).toEqual({ ranking: [], closing: [] });
  });
});
