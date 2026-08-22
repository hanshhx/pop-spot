import { describe, expect, it } from 'vitest';

import {
  SEASON_AUTO,
  SEASON_COOKIE,
  isPinned,
  parseSeasonSetting,
  resolveSeason,
  seasonCookie,
} from './seasonOverride';

/** KST 로 그 날 정오. */
function kst(month: number, day: number): Date {
  return new Date(Date.UTC(2026, month - 1, day, 3, 0, 0));
}

describe('parseSeasonSetting', () => {
  it('아는 계절만 받는다', () => {
    expect(parseSeasonSetting('winter')).toBe('winter');
    expect(parseSeasonSetting('spring')).toBe('spring');
  });

  it('모르는 값은 자동으로 물러선다', () => {
    // 쿠키는 사용자가 손으로 고칠 수 있다. 믿고 그대로 쓰면 없는 계절이 화면까지 올라간다.
    expect(parseSeasonSetting('christmas')).toBe(SEASON_AUTO);
    expect(parseSeasonSetting('<script>')).toBe(SEASON_AUTO);
    expect(parseSeasonSetting('')).toBe(SEASON_AUTO);
    expect(parseSeasonSetting(null)).toBe(SEASON_AUTO);
    expect(parseSeasonSetting(undefined)).toBe(SEASON_AUTO);
  });
});

describe('resolveSeason', () => {
  it('고정이 없으면 날짜를 따른다', () => {
    expect(resolveSeason(SEASON_AUTO, kst(8, 22))).toBe('summer');
    expect(resolveSeason(SEASON_AUTO, kst(1, 5))).toBe('winter');
  });

  it('고정이 있으면 날짜를 무시한다', () => {
    // 한여름에 겨울 테마를 보려는 것이 이 기능의 존재 이유다.
    expect(resolveSeason('winter', kst(8, 22))).toBe('winter');
  });

  it('고정 값이 마침 지금 계절과 같아도 그대로 쓴다', () => {
    expect(resolveSeason('summer', kst(8, 22))).toBe('summer');
  });
});

describe('isPinned', () => {
  it('자동은 고정이 아니다', () => {
    expect(isPinned(SEASON_AUTO)).toBe(false);
    expect(isPinned('autumn')).toBe(true);
  });
});

describe('seasonCookie', () => {
  it('고정하면 1년을 둔다', () => {
    const c = seasonCookie('autumn');
    expect(c).toContain(`${SEASON_COOKIE}=autumn`);
    expect(c).toContain('Max-Age=31536000');
    expect(c).toContain('Path=/');
    expect(c).toContain('SameSite=Lax');
  });

  it('자동으로 되돌리면 쿠키를 지운다', () => {
    // 'auto' 를 값으로 넣어 두면, 나중에 기본 동작이 바뀌어도 이 쿠키가 옛 동작에 묶어 둔다.
    const c = seasonCookie(SEASON_AUTO);
    expect(c).toContain('Max-Age=0');
    expect(c).not.toContain('auto');
  });
});
