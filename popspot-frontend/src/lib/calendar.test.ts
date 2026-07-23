import { describe, expect, it } from 'vitest';

import { toCalendarEvent } from './calendar';

describe('팝업 캘린더 날짜 검증', () => {
  it('실재하지 않는 날짜나 역전된 기간은 저장하지 않는다', () => {
    expect(
      toCalendarEvent({ id: 1, name: '오류 날짜', startDate: '2026-02-30', endDate: '2026-03-01' }),
    ).toBeNull();
    expect(
      toCalendarEvent({ id: 2, name: '역전 기간', startDate: '2026-07-22', endDate: '2026-07-21' }),
    ).toBeNull();
  });

  it('종일 일정 종료일은 실제 마감 다음 날을 exclusive 값으로 사용한다', () => {
    const event = toCalendarEvent({
      id: 3,
      name: '검증 팝업',
      address: '서울 성동구',
      startDate: '2026-07-20',
      endDate: '2026-07-22',
    });

    expect(event).toMatchObject({
      startCompact: '20260720',
      endExclusiveCompact: '20260723',
      url: 'https://popspot.co.kr/popup/3',
    });
  });
});
