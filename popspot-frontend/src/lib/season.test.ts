import { describe, expect, it } from 'vitest';

import { resolveSeason, seasonOfMonth } from './season';

describe('계절 판정', () => {
  it('12월은 다음 해 겨울의 시작이라 나머지 연산으로 접으면 경계가 어긋난다', () => {
    expect(seasonOfMonth(12)).toBe('winter');
    expect(seasonOfMonth(1)).toBe('winter');
    expect(seasonOfMonth(2)).toBe('winter');
    expect(seasonOfMonth(3)).toBe('spring');
    expect(seasonOfMonth(5)).toBe('spring');
    expect(seasonOfMonth(6)).toBe('summer');
    expect(seasonOfMonth(8)).toBe('summer');
    expect(seasonOfMonth(9)).toBe('autumn');
    expect(seasonOfMonth(11)).toBe('autumn');
  });

  it('주소 오버라이드 > 관리자 지정 > 월 자동 순으로 이긴다', () => {
    const august = new Date(2026, 7, 22);

    expect(resolveSeason('winter', 'spring', august)).toBe('winter');
    expect(resolveSeason(null, 'spring', august)).toBe('spring');
    expect(resolveSeason(null, 'auto', august)).toBe('summer');
    expect(resolveSeason(null, null, august)).toBe('summer');
  });

  it('알 수 없는 값은 무시하고 다음 순위로 넘어간다', () => {
    const august = new Date(2026, 7, 22);

    expect(resolveSeason('여름', 'winter', august)).toBe('winter');
    expect(resolveSeason(null, 'nonsense', august)).toBe('summer');
  });
});
