import { describe, expect, it } from 'vitest';

import { SEASON_MONTHS, isInSeason, seasonOf, seasonOfMonth, solarTermOf } from './season';

/** KST 로 그 날 정오. 시간대 때문에 하루가 밀리는 것을 피한다. */
function kst(month: number, day: number, year = 2026): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0)); // 12:00 KST
}

describe('seasonOfMonth', () => {
  it('기상청 기준 3개월씩 묶는다', () => {
    expect([3, 4, 5].map(seasonOfMonth)).toEqual(['spring', 'spring', 'spring']);
    expect([6, 7, 8].map(seasonOfMonth)).toEqual(['summer', 'summer', 'summer']);
    expect([9, 10, 11].map(seasonOfMonth)).toEqual(['autumn', 'autumn', 'autumn']);
  });

  it('겨울은 해를 넘긴다', () => {
    // 12·1·2 가 한 계절이다. 월 범위로만 판정하면 12 > 2 라 놓치기 쉽다.
    expect([12, 1, 2].map(seasonOfMonth)).toEqual(['winter', 'winter', 'winter']);
  });

  it('열두 달이 빠짐없이 배정된다', () => {
    const counts = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    for (let m = 1; m <= 12; m++) counts[seasonOfMonth(m)]++;
    expect(counts).toEqual({ spring: 3, summer: 3, autumn: 3, winter: 3 });
  });

  it('SEASON_MONTHS 가 판정과 어긋나지 않는다', () => {
    // 두 곳에 적힌 값이라 한쪽만 고치면 묶음 페이지와 배경이 다른 계절을 말하게 된다.
    for (const [season, months] of Object.entries(SEASON_MONTHS)) {
      for (const m of months) expect(seasonOfMonth(m)).toBe(season);
    }
  });
});

describe('seasonOf', () => {
  it('경계 날짜', () => {
    expect(seasonOf(kst(2, 28))).toBe('winter');
    expect(seasonOf(kst(3, 1))).toBe('spring');
    expect(seasonOf(kst(5, 31))).toBe('spring');
    expect(seasonOf(kst(6, 1))).toBe('summer');
    expect(seasonOf(kst(11, 30))).toBe('autumn');
    expect(seasonOf(kst(12, 1))).toBe('winter');
  });

  it('계절이 바뀌는 날 아침에도 KST 를 따른다', () => {
    // 12월 1일 오전 8시(KST) = 11월 30일 23시(UTC). UTC 로 보면 아직 가을이라
    // 서버와 브라우저가 다른 계절을 그린다.
    const kstMorningDec1 = new Date(Date.UTC(2026, 10, 30, 23, 0, 0));
    expect(seasonOf(kstMorningDec1)).toBe('winter');
  });

  it('절기로 여름이어도 5월은 봄이다', () => {
    // 입하(5/5)가 지나도 기상청 기준으로는 봄이다. 절기가 계절을 뒤집으면
    // 5월 초에 배경이 갑자기 여름으로 바뀐다.
    expect(seasonOf(kst(5, 10))).toBe('spring');
    expect(solarTermOf(kst(5, 10))).toBe('입하');
  });
});

describe('solarTermOf', () => {
  it('지나온 절기를 말한다 — 아직 안 온 절기가 아니라', () => {
    expect(solarTermOf(kst(2, 4))).toBe('입춘'); // 당일
    expect(solarTermOf(kst(2, 10))).toBe('입춘'); // 우수 전까지 계속 입춘 무렵
    expect(solarTermOf(kst(2, 19))).toBe('우수');
  });

  it('사용자가 준 날짜와 맞는다', () => {
    expect(solarTermOf(kst(3, 21))).toBe('춘분');
    expect(solarTermOf(kst(6, 21))).toBe('하지');
    expect(solarTermOf(kst(9, 23))).toBe('추분');
    expect(solarTermOf(kst(12, 22))).toBe('동지');
    expect(solarTermOf(kst(8, 7))).toBe('입추');
    expect(solarTermOf(kst(11, 7))).toBe('입동');
  });

  it('연초에는 작년 마지막 절기로 물러선다', () => {
    // 1월 1~5일은 그 해 첫 절기(소한 1/6) 전이다. 빈 값을 돌려주면 화면에 빈 칸이 남는다.
    expect(solarTermOf(kst(1, 1))).toBe('동지');
    expect(solarTermOf(kst(1, 5))).toBe('동지');
    expect(solarTermOf(kst(1, 6))).toBe('소한');
  });

  it('어느 날짜에도 빈 값을 주지 않는다', () => {
    for (let m = 1; m <= 12; m++) {
      for (const d of [1, 15, 28]) {
        expect(solarTermOf(kst(m, d))).toMatch(/^[가-힣]{2}$/);
      }
    }
  });
});

describe('isInSeason', () => {
  it('겨울에 1월과 12월이 함께 든다', () => {
    expect(isInSeason(kst(1, 15), 'winter')).toBe(true);
    expect(isInSeason(kst(12, 15), 'winter')).toBe(true);
    expect(isInSeason(kst(7, 15), 'winter')).toBe(false);
  });
});
