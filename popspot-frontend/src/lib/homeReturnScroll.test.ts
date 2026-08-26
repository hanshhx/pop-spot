import { describe, expect, it } from 'vitest';

import { isPopupDetailPath, resolveHomeReturnScroll } from './homeReturnScroll';

const ONE_MINUTE_MS = 60_000;
const THIRTY_ONE_MINUTES_MS = 31 * ONE_MINUTE_MS;

describe('resolveHomeReturnScroll', () => {
  it('저장된 지 1분 지난 유효한 항목은 그 위치로 복원한다', () => {
    const now = 1_000_000;
    const raw = { scrollY: 1200, search: '?tab=MAP', savedAt: now - ONE_MINUTE_MS };
    expect(resolveHomeReturnScroll(raw, '?tab=MAP', now)).toBe(1200);
  });

  it('같은 항목이라도 31분 지났으면 복원하지 않는다', () => {
    const now = 1_000_000;
    const raw = { scrollY: 1200, search: '?tab=MAP', savedAt: now - THIRTY_ONE_MINUTES_MS };
    expect(resolveHomeReturnScroll(raw, '?tab=MAP', now)).toBeNull();
  });

  it('검색조건이 다르면 복원하지 않는다 — 다른 필터 화면에 옛 스크롤을 앉히지 않는다', () => {
    const now = 1_000_000;
    const raw = { scrollY: 1200, search: '?tab=MAP', savedAt: now - ONE_MINUTE_MS };
    expect(resolveHomeReturnScroll(raw, '?tab=MY', now)).toBeNull();
  });

  it('scrollY 가 없거나 숫자가 아니면 복원하지 않고 예외도 던지지 않는다', () => {
    const now = 1_000_000;
    expect(
      resolveHomeReturnScroll({ search: '?tab=MAP', savedAt: now }, '?tab=MAP', now),
    ).toBeNull();
    expect(
      resolveHomeReturnScroll(
        { scrollY: '1200', search: '?tab=MAP', savedAt: now },
        '?tab=MAP',
        now,
      ),
    ).toBeNull();
  });

  it('저장된 값 자체가 null 이거나 객체가 아니어도 예외를 던지지 않는다', () => {
    const now = 1_000_000;
    expect(resolveHomeReturnScroll(null, '?tab=MAP', now)).toBeNull();
    expect(resolveHomeReturnScroll(undefined, '?tab=MAP', now)).toBeNull();
    expect(resolveHomeReturnScroll('garbage', '?tab=MAP', now)).toBeNull();
    expect(resolveHomeReturnScroll(42, '?tab=MAP', now)).toBeNull();
  });
});

describe('isPopupDetailPath', () => {
  it('로케일 접두사가 없거나 en/ja 접두사가 붙은 상세 경로를 모두 인정한다', () => {
    expect(isPopupDetailPath('/popup/123')).toBe(true);
    expect(isPopupDetailPath('/en/popup/123')).toBe(true);
    expect(isPopupDetailPath('/ja/popup/123')).toBe(true);
  });

  it('카탈로그 랜딩(복수형)은 상세 경로로 보지 않는다', () => {
    expect(isPopupDetailPath('/popups/seongsu')).toBe(false);
    expect(isPopupDetailPath('/en/popups/gangnam')).toBe(false);
  });

  it('id 없는 /popup/ 만으로는 상세 경로로 보지 않는다', () => {
    expect(isPopupDetailPath('/popup/')).toBe(false);
    expect(isPopupDetailPath('/popup')).toBe(false);
  });
});
