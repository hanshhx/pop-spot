import { describe, expect, it } from 'vitest';

import { isSeasonLimited, resolveSeason, seasonOfMonth } from './season';

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

describe('계절 한정 판정', () => {
  const august = new Date(2026, 7, 22);

  it('오늘 마감하는 팝업은 계절 한정에 <b>포함된다</b>', () => {
    // 시각으로 비교하면 오늘 자정이 과거가 되어 빠진다 — 가장 급한 한 칸이 그날 사라진다.
    expect(isSeasonLimited('2026-08-22', 'summer', august)).toBe(true);
  });

  it('이미 끝난 팝업은 한정이라고 부를 게 없다', () => {
    expect(isSeasonLimited('2026-08-21', 'summer', august)).toBe(false);
  });

  it('다른 계절에 마감하면 이번 계절 한정이 아니다', () => {
    expect(isSeasonLimited('2026-09-01', 'summer', august)).toBe(false);
    expect(isSeasonLimited('2026-09-01', 'autumn', august)).toBe(true);
  });

  it('내년 같은 계절까지 한정으로 부르면 마감의 의미가 없어진다', () => {
    expect(isSeasonLimited('2027-08-01', 'summer', august)).toBe(false);
  });

  it('날짜가 없거나 읽을 수 없으면 한정이 아니다', () => {
    expect(isSeasonLimited(undefined, 'summer', august)).toBe(false);
    expect(isSeasonLimited('', 'summer', august)).toBe(false);
    expect(isSeasonLimited('마감일 미정', 'summer', august)).toBe(false);
  });
});
