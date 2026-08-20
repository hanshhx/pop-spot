import { describe, expect, it } from 'vitest';

import { searchLandingTitle } from './searchLandingTitle';

describe('searchLandingTitle', () => {
  it('지역 페이지는 현재 건수와 오늘·이번 주 의도를 함께 설명한다', () => {
    expect(
      searchLandingTitle({
        locale: 'ko',
        kind: 'region',
        slug: 'jamsil',
        label: '잠실',
        count: 43,
      }),
    ).toBe('잠실 팝업스토어 43곳 | 오늘·이번 주 일정·위치');
  });

  it('오프사이드는 실제 유입 검색어인 스토어 표현을 쓴다', () => {
    expect(
      searchLandingTitle({
        locale: 'ko',
        kind: 'brand',
        slug: 'offside',
        label: '오프사이드',
        count: 1,
      }),
    ).toBe('오프사이드 스토어 팝업 1곳 | 일정·위치');
  });

  it('자료가 부족한 외국어와 결과가 없는 페이지는 기존 제목에 맡긴다', () => {
    expect(
      searchLandingTitle({
        locale: 'en',
        kind: 'region',
        slug: 'jamsil',
        label: 'Jamsil',
        count: 43,
      }),
    ).toBeNull();
    expect(
      searchLandingTitle({
        locale: 'ko',
        kind: 'brand',
        slug: 'offside',
        label: '오프사이드',
        count: 0,
      }),
    ).toBeNull();
  });
});
