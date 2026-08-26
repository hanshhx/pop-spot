import { describe, expect, it } from 'vitest';

import type { PopupStore } from '@/types/popup';

import { catalogDoors } from './catalogDoors';

/** KST 2026-08-26 자정. homeSurfaces.test.ts 와 같은 고정 시점. */
const TODAY = new Date('2026-08-26T00:00:00+09:00');

const p = (
  id: number,
  category: string,
  location: string,
  start: string,
  end: string,
  name = `p${id}`,
): PopupStore =>
  ({
    id,
    name,
    category,
    location,
    startDate: start,
    endDate: end,
  }) as unknown as PopupStore;

describe('catalogDoors', () => {
  it('빈 풀이면 문을 하나도 만들지 않는다', () => {
    expect(catalogDoors([], TODAY, 4)).toEqual([]);
  });

  it('카테고리 문은 자기 뒤에 몇 곳 있는지 정확히 센다', () => {
    const pool = [
      p(1, 'FASHION', '서울 강남구', '2026-08-01', '2026-12-31'),
      p(2, 'FASHION', '서울 강남구', '2026-08-01', '2026-12-31'),
      p(3, 'FOOD', '서울 마포구', '2026-08-01', '2026-12-31'),
    ];
    const doors = catalogDoors(pool, TODAY, 4);
    const fashion = doors.find((d) => d.key.includes('fashion'));
    expect(fashion?.count).toBe(2);
    expect(fashion?.href).toBe('/popups/fashion');
  });

  it('지역 문도 같은 방식으로 정확히 센다 — 랜딩(classifyRegion)과 같은 분류를 쓴다', () => {
    const pool = [
      p(1, 'FASHION', '서울 강남구', '2026-08-01', '2026-12-31'),
      p(2, 'FASHION', '서울 강남대로', '2026-08-01', '2026-12-31'),
      p(3, 'FOOD', '서울 마포대로', '2026-08-01', '2026-12-31'),
    ];
    const doors = catalogDoors(pool, TODAY, 4);
    const gangnam = doors.find((d) => d.key === 'region:gangnam');
    expect(gangnam?.count).toBe(2);
  });

  it('브랜드가 하나도 안 걸리면 브랜드 문은 생기지 않는다 — 문 뒤가 비면 문도 없다', () => {
    const pool = [
      p(1, 'FASHION', '서울 강남구', '2026-08-01', '2026-12-31'),
      p(2, 'FOOD', '서울 마포구', '2026-08-01', '2026-12-31'),
    ];
    const doors = catalogDoors(pool, TODAY, 4);
    expect(doors.some((d) => d.key.startsWith('brand:'))).toBe(false);
    expect(doors.every((d) => d.count > 0)).toBe(true);
  });

  it('네 문의 축이 서로 다르다 — 같은 종류를 넷 늘어놓지 않는다', () => {
    const pool = Array.from({ length: 20 }, (_, i) =>
      p(i, i % 2 ? 'FASHION' : 'FOOD', '서울 강남구', '2026-08-25', '2026-08-28'),
    );
    const doors = catalogDoors(pool, TODAY, 4);
    const axes = new Set(doors.map((d) => d.href.split('/')[2]?.split('-')[0]));
    expect(axes.size).toBeGreaterThan(1);
  });

  it('limit 을 넘지 않는다', () => {
    const pool = Array.from({ length: 50 }, (_, i) =>
      p(i, 'FASHION', '서울 강남구', '2026-08-25', '2026-08-28'),
    );
    expect(catalogDoors(pool, TODAY, 4).length).toBeLessThanOrEqual(4);
  });

  it('네 축이 전부 살아 있으면 limit 만큼만 자른다', () => {
    const pool = [
      ...Array.from({ length: 10 }, (_, i) =>
        p(i, 'FASHION', '서울 강남구', '2026-08-25', '2026-08-28'),
      ),
      p(100, 'CHARACTER', '서울 강남구', '2026-08-25', '2026-08-28', '포켓몬 팝업'),
    ];
    expect(catalogDoors(pool, TODAY, 4)).toHaveLength(4);
    expect(catalogDoors(pool, TODAY, 2)).toHaveLength(2);
  });

  it('개수가 0인 문은 절대 나가지 않는다', () => {
    const pool = [p(1, 'FASHION', '서울 강남구', '2026-08-01', '2026-12-31')];
    const doors = catalogDoors(pool, TODAY, 4);
    expect(doors.every((d) => d.count > 0)).toBe(true);
  });
});
