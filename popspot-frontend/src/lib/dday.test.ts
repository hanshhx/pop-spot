import { describe, expect, it } from 'vitest';

import { daysUntilEnd, ddayBadge } from './dday';

/**
 * 마감까지 남은 날 — 화면 전체가 이 한 곳을 본다.
 *
 * <p>예전에는 같은 산수가 다섯 곳에 복사돼 있었다. 셋은 글자까지 같았고 둘은 계산이 달랐다.
 * 복사본이 늘어나면 "홈은 D-2 인데 상세는 D-1" 이 되는 날이 오고, 그때 어느 쪽이 옳은지
 * 아무도 모른다.
 *
 * <p>기준 시각을 인자로 받는 것은 <b>테스트 때문이 아니라 시간대 때문</b>이다. 날짜 문자열과
 * 기준 시각을 같은 방식으로 만들면(둘 다 'YYYY-MM-DD' 파싱) 두 값이 함께 밀리므로 차이는
 * 어느 시간대에서든 같다 — CI(UTC)와 이 기계(KST)가 다른 답을 내지 않는다.
 */
const TODAY = new Date('2026-08-23');

describe('daysUntilEnd', () => {
  it('마감일이 미래면 남은 날 수를 준다', () => {
    expect(daysUntilEnd('2026-08-31', TODAY)).toBe(8);
  });

  it('오늘 마감이면 0 이다', () => {
    expect(daysUntilEnd('2026-08-23', TODAY)).toBe(0);
  });

  it('이미 지난 마감일은 음수다', () => {
    expect(daysUntilEnd('2026-08-20', TODAY)).toBe(-3);
  });

  it('마감일이 없거나 읽을 수 없으면 null 이다 — 0 이 아니다', () => {
    expect(daysUntilEnd(undefined, TODAY)).toBeNull();
    expect(daysUntilEnd(null, TODAY)).toBeNull();
    expect(daysUntilEnd('', TODAY)).toBeNull();
    expect(daysUntilEnd('내일까지', TODAY)).toBeNull();
  });
});

describe('ddayBadge', () => {
  it('끝난 팝업은 ended 로 표시한다 — 문구가 아니라 이 값으로 색을 고르라고 나눠 둔 것이다', () => {
    expect(ddayBadge('2026-08-20', TODAY)).toEqual({
      labelKey: 'misc.cardEnded',
      days: -3,
      ended: true,
    });
  });

  it('오늘 마감은 정해진 문구를 쓴다', () => {
    expect(ddayBadge('2026-08-23', TODAY)).toEqual({
      labelKey: 'card.today',
      days: 0,
      ended: false,
    });
  });

  it('남은 날이 있으면 문구 대신 일수를 준다', () => {
    expect(ddayBadge('2026-08-31', TODAY)).toEqual({
      labelKey: null,
      days: 8,
      ended: false,
    });
  });

  it('마감일을 모르면 배지 자체가 없다', () => {
    expect(ddayBadge(undefined, TODAY)).toBeNull();
  });
});
