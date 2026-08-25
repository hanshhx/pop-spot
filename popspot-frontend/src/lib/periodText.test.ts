import { describe, expect, it } from 'vitest';

import { periodText } from './periodText';

describe('periodText', () => {
  it('시작일과 종료일이 다 있으면 양쪽을 적는다', () => {
    expect(periodText('2026-07-22', '2026-08-31')).toBe('07-22 ~ 08-31');
  });

  it('시작일만 있으면 시작일을 적는다 — 아는 날짜를 버리고 "-" 를 찍지 않는다', () => {
    expect(periodText('2026-09-15', null)).toBe('09-15 ~');
  });

  it('종료일만 있으면 종료일을 적는다', () => {
    expect(periodText(null, '2026-08-31')).toBe('~ 08-31');
  });

  it('둘 다 없을 때만 "-" 다', () => {
    expect(periodText(null, null)).toBe('-');
  });

  it('빈 문자열은 없는 것으로 본다', () => {
    expect(periodText('', '')).toBe('-');
  });
});
