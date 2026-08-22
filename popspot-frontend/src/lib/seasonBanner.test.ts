import { describe, expect, it } from 'vitest';

import {
  BANNER_WINDOW_DAYS,
  SEASON_BANNER_COPY,
  daysSinceSeasonStart,
  seasonStart,
  shouldShowSeasonBanner,
} from './seasonBanner';
import { SEASONS } from '@/lib/season';

/** KST 로 그 날 정오. */
function kst(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
}

const base = { dismissedSeason: null, returning: true } as const;

describe('seasonStart', () => {
  it('계절 첫 달 1일', () => {
    expect(seasonStart('summer', kst(2026, 7, 15)).toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(seasonStart('spring', kst(2026, 4, 2)).toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  it('1월·2월의 겨울은 작년 12월에 시작한다', () => {
    // 이 시험이 이 파일의 존재 이유다. 놓치면 1월 내내 "겨울이 시작됐어요" 가 뜬다.
    expect(seasonStart('winter', kst(2027, 1, 20)).toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(seasonStart('winter', kst(2027, 2, 5)).toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('12월의 겨울은 그 해 12월에 시작한다', () => {
    expect(seasonStart('winter', kst(2026, 12, 9)).toISOString().slice(0, 10)).toBe('2026-12-01');
  });
});

describe('daysSinceSeasonStart', () => {
  it('시작 당일은 0일', () => {
    expect(daysSinceSeasonStart('summer', kst(2026, 6, 1))).toBe(0);
  });

  it('보름이면 15일', () => {
    expect(daysSinceSeasonStart('summer', kst(2026, 6, 16))).toBe(15);
  });

  it('1월의 겨울은 한 달이 넘었다', () => {
    expect(daysSinceSeasonStart('winter', kst(2027, 1, 15))).toBeGreaterThan(BANNER_WINDOW_DAYS);
  });
});

describe('shouldShowSeasonBanner', () => {
  it('계절 시작 2주 안에는 띄운다', () => {
    expect(shouldShowSeasonBanner({ ...base, season: 'summer', now: kst(2026, 6, 1) })).toBe(true);
    expect(shouldShowSeasonBanner({ ...base, season: 'summer', now: kst(2026, 6, 13) })).toBe(true);
  });

  it('2주가 지나면 안 띄운다', () => {
    // 상주하면 3일 만에 눈에서 지워지고 광고로 읽힌다.
    expect(shouldShowSeasonBanner({ ...base, season: 'summer', now: kst(2026, 6, 15) })).toBe(false);
    expect(shouldShowSeasonBanner({ ...base, season: 'summer', now: kst(2026, 8, 22) })).toBe(false);
  });

  it('닫은 계절에는 다시 안 뜬다', () => {
    expect(
      shouldShowSeasonBanner({
        ...base,
        season: 'summer',
        now: kst(2026, 6, 3),
        dismissedSeason: 'summer',
      }),
    ).toBe(false);
  });

  it('다른 계절을 닫은 것은 이 계절과 무관하다', () => {
    // 봄에 닫았다고 여름 배너까지 막으면 계절이 바뀐 것을 영영 모른다.
    expect(
      shouldShowSeasonBanner({
        ...base,
        season: 'summer',
        now: kst(2026, 6, 3),
        dismissedSeason: 'spring',
      }),
    ).toBe(true);
  });

  it('첫 방문자에게는 띄우지 않는다', () => {
    // 비교할 기억이 없으니 "여름이 시작됐어요" 가 뜬금없는 광고가 된다.
    expect(
      shouldShowSeasonBanner({
        season: 'summer',
        now: kst(2026, 6, 3),
        dismissedSeason: null,
        returning: false,
      }),
    ).toBe(false);
  });

  it('1월 겨울에는 안 뜬다 — 12월에 이미 지나갔다', () => {
    expect(shouldShowSeasonBanner({ ...base, season: 'winter', now: kst(2027, 1, 5) })).toBe(false);
  });

  it('12월 초 겨울에는 뜬다', () => {
    expect(shouldShowSeasonBanner({ ...base, season: 'winter', now: kst(2026, 12, 3) })).toBe(true);
  });
});

describe('SEASON_BANNER_COPY', () => {
  it('네 계절 모두 문구가 있다', () => {
    for (const season of SEASONS) {
      expect(SEASON_BANNER_COPY[season].lead).toBeTruthy();
      expect(SEASON_BANNER_COPY[season].body).toBeTruthy();
    }
  });

  it('무엇이 몰리는지 말한다 — 계절 이름만 말하지 않는다', () => {
    // "봄이 왔어요" 는 아무것도 알려주지 않는다. 계절이 목록의 내용을 바꾼다는 사실을 말해야 한다.
    for (const season of SEASONS) {
      expect(SEASON_BANNER_COPY[season].body.length).toBeGreaterThan(20);
      expect(SEASON_BANNER_COPY[season].body).toMatch(/팝업|스토어|마켓|카페/);
    }
  });
});
