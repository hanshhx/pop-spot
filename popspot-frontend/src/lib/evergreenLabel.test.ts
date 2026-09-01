import { describe, expect, it } from 'vitest';

import { evergreenLabel } from './evergreenLabel';

/**
 * 이 함수가 하는 일은 <b>빼는 것</b>이라, 위험이 양쪽에 있다. 덜 빼면 낡은 날짜가 제목에 남고,
 * 더 빼면 지명·브랜드의 괄호까지 지워 제목이 망가진다. 아래 시험은 그 둘을 함께 잡는다.
 */
describe('evergreenLabel', () => {
  it('주간 구간을 뺀다', () => {
    expect(evergreenLabel('이번 주 (8/31~9/6)')).toBe('이번 주');
    expect(evergreenLabel('이번 주 (8/31~9/6) 홍대')).toBe('이번 주 홍대');
  });

  it('주말·오늘·내일의 날짜도 뺀다', () => {
    expect(evergreenLabel('이번 주말 (9/5)')).toBe('이번 주말');
    expect(evergreenLabel('다음 주말 (9/12) 성수')).toBe('다음 주말 성수');
    expect(evergreenLabel('오늘 (9/1 화)')).toBe('오늘');
    expect(evergreenLabel('내일 (9/2 수) 잠실')).toBe('내일 잠실');
  });

  /*
   * 이게 반대쪽 위험이다. 괄호를 무조건 지우면 지명·브랜드가 망가진다.
   * 숫자와 슬래시를 요구하는 이유가 이것뿐이다.
   */
  it('날짜가 아닌 괄호는 남긴다', () => {
    expect(evergreenLabel('더현대 (여의도)')).toBe('더현대 (여의도)');
    expect(evergreenLabel('성수 (연무장길)')).toBe('성수 (연무장길)');
    expect(evergreenLabel('AK플라자 (홍대)')).toBe('AK플라자 (홍대)');
  });

  /* 달 이름은 날짜 구간이 아니다. 네이버는 오히려 그 형태로 검색한다. */
  it('달 이름은 남긴다', () => {
    expect(evergreenLabel('9월')).toBe('9월');
    expect(evergreenLabel('9월 성수')).toBe('9월 성수');
  });

  it('뺄 것이 없으면 그대로 둔다', () => {
    expect(evergreenLabel('성수')).toBe('성수');
    expect(evergreenLabel('코엑스')).toBe('코엑스');
    expect(evergreenLabel('')).toBe('');
  });

  it('빼고 남은 공백을 정리한다', () => {
    expect(evergreenLabel('이번 주  (8/31~9/6)  홍대')).toBe('이번 주 홍대');
    expect(evergreenLabel('(9/1 화)')).toBe('');
  });
});
