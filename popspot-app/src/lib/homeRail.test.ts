import { describe, expect, it } from 'vitest';

import { RAIL_POPUP_COUNT, railCategoryCodes, railPopups } from './homeRail';
import type { PopupStore } from '@/types/popup';

const p = (
  id: number,
  extra: Partial<PopupStore> = {},
): PopupStore =>
  ({
    id,
    name: `팝업 ${id}`,
    location: '서울 성동구',
    status: 'ACTIVE',
    viewCount: 0,
    ...extra,
  }) as PopupStore;

const ids = (list: PopupStore[]) => list.map((x) => x.id);

describe('railPopups — latest(기본)', () => {
  it('시작일이 늦은 것부터 — 이것이 "최근 오픈" 이다', () => {
    const out = railPopups([
      p(1, { startDate: '2026-08-01' }),
      p(2, { startDate: '2026-08-29' }),
      p(3, { startDate: '2026-08-15' }),
    ]);
    expect(ids(out)).toEqual([2, 3, 1]);
  });

  it('시작일이 없는 것은 맨 뒤로', () => {
    const out = railPopups([p(1), p(2, { startDate: '2026-01-01' })]);
    expect(ids(out)).toEqual([2, 1]);
  });

  it('같은 날 시작이면 id 가 큰 것부터 — 순서가 흔들리지 않게', () => {
    const out = railPopups([
      p(5, { startDate: '2026-08-20' }),
      p(9, { startDate: '2026-08-20' }),
      p(7, { startDate: '2026-08-20' }),
    ]);
    expect(ids(out)).toEqual([9, 7, 5]);
  });

  it('달력에 없는 날짜는 이월시키지 않고 없는 것으로 본다', () => {
    // Date.parse('2026-02-31') 은 3월 2일이 된다 — 그러면 2월 팝업이 3월 팝업보다 최신이 된다.
    const out = railPopups([
      p(1, { startDate: '2026-02-31' }),
      p(2, { startDate: '2026-03-01' }),
    ]);
    expect(ids(out)).toEqual([2, 1]);
  });
});

describe('railPopups — deadline', () => {
  it('마감이 가까운 것부터', () => {
    const out = railPopups(
      [
        p(1, { endDate: '2026-09-30' }),
        p(2, { endDate: '2026-09-01' }),
        p(3, { endDate: '2026-09-15' }),
      ],
      'deadline',
    );
    expect(ids(out)).toEqual([2, 3, 1]);
  });

  it('종료일을 모르는 것은 맨 뒤 — "모른다" 를 "가장 급하다" 로 읽으면 안 된다', () => {
    const out = railPopups([p(1), p(2, { endDate: '2026-12-31' })], 'deadline');
    expect(ids(out)).toEqual([2, 1]);
  });

  it('마감이 같으면 조회수가 높은 것부터', () => {
    const out = railPopups(
      [p(1, { endDate: '2026-09-01', viewCount: 5 }), p(2, { endDate: '2026-09-01', viewCount: 50 })],
      'deadline',
    );
    expect(ids(out)).toEqual([2, 1]);
  });
});

describe('railPopups — popular', () => {
  it('조회수가 높은 것부터, 동점은 id 로 안정화', () => {
    const out = railPopups(
      [p(1, { viewCount: 0 }), p(3, { viewCount: 0 }), p(2, { viewCount: 100 })],
      'popular',
    );
    expect(ids(out)).toEqual([2, 3, 1]);
  });
});

describe('railPopups — 공통', () => {
  it('카테고리로 거른다', () => {
    const out = railPopups(
      [p(1, { category: '패션' }), p(2, { category: '뷰티' }), p(3, { category: '패션' })],
      'latest',
      'fashion',
    );
    expect(ids(out).sort()).toEqual([1, 3]);
  });

  it('상한까지만 돌려준다', () => {
    const many = Array.from({ length: RAIL_POPUP_COUNT + 20 }, (_, i) => p(i));
    expect(railPopups(many)).toHaveLength(RAIL_POPUP_COUNT);
  });

  it('원본 배열을 정렬하지 않는다', () => {
    const input = [p(1, { startDate: '2026-01-01' }), p(2, { startDate: '2026-08-01' })];
    railPopups(input);
    expect(ids(input)).toEqual([1, 2]);
  });

  it('빈 목록도 견딘다', () => {
    expect(railPopups([])).toEqual([]);
  });
});

describe('railCategoryCodes', () => {
  it('목록에 실제로 있는 분야만 — 개수 0 인 칩은 만들지 않는다', () => {
    const codes = railCategoryCodes([p(1, { category: '패션' }), p(2, { category: '뷰티' })]);
    expect(codes.has('fashion')).toBe(true);
    expect(codes.has('beauty')).toBe(true);
    expect(codes.size).toBe(2);
  });
});
