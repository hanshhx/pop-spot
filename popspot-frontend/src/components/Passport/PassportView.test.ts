import { describe, expect, it } from 'vitest';

import { normalizeStampResponse } from './PassportView';

describe('여권 스탬프 응답 방어', () => {
  it('401/403 오류 JSON처럼 배열이 아닌 응답은 빈 여권으로 처리한다', () => {
    expect(normalizeStampResponse({ error: 'FORBIDDEN', status: 403 })).toEqual([]);
    expect(normalizeStampResponse(null)).toEqual([]);
  });

  it('정상 배열은 그대로 유지한다', () => {
    const stamps = [{ id: 1, stampDate: '2026-07-22', popupStore: { popupId: 1 } }];
    expect(normalizeStampResponse(stamps)).toBe(stamps);
  });
});
