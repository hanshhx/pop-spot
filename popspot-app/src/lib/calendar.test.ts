import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Linking: { openURL: vi.fn() } }));

const { googleCalendarUrl, toCalendarEvent } = await import('./calendar');

/**
 * 웹 {@code calendar.test.ts} 를 그대로 옮기고, 웹에는 없는 URL 조립 검증을 더했다.
 * 앱은 {@code .ics} 를 만들지 않으므로 그 부분은 옮길 것이 없다(이유는 calendar.ts 주석).
 */

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

  it('한쪽 날짜만 있으면 만들지 않는다 — 버튼을 그리지 않게 하는 신호다', () => {
    expect(toCalendarEvent({ id: 4, name: 'x', startDate: '2026-07-20' })).toBeNull();
    expect(toCalendarEvent({ id: 5, name: 'x', endDate: '2026-07-20' })).toBeNull();
    expect(toCalendarEvent({ id: 6, name: 'x' })).toBeNull();
  });

  it('하루짜리 팝업도 만든다 — 시작과 종료가 같으면 다음 날까지가 하루다', () => {
    expect(
      toCalendarEvent({ id: 7, name: 'x', startDate: '2026-07-20', endDate: '2026-07-20' }),
    ).toMatchObject({ startCompact: '20260720', endExclusiveCompact: '20260721' });
  });

  it('월말·연말을 넘겨도 다음 날이 맞다', () => {
    expect(
      toCalendarEvent({ id: 8, name: 'x', startDate: '2026-12-30', endDate: '2026-12-31' })
        ?.endExclusiveCompact,
    ).toBe('20270101');
    expect(
      toCalendarEvent({ id: 9, name: 'x', startDate: '2028-02-28', endDate: '2028-02-29' })
        ?.endExclusiveCompact,
    ).toBe('20280301');
  });
});

describe('googleCalendarUrl', () => {
  const ev = toCalendarEvent({
    id: 10,
    name: '조광 & 페인터 팝업',
    address: '서울 성동구 연무장길 1',
    startDate: '2026-07-20',
    endDate: '2026-07-22',
  })!;

  it('이름의 & 가 파라미터를 자르지 않는다', () => {
    const url = googleCalendarUrl(ev);
    const text = new URL(url).searchParams.get('text');
    // 손으로 이어붙이면 여기서 '조광 ' 까지만 남는다.
    expect(text).toBe('조광 & 페인터 팝업');
  });

  it('기간은 시작/종료exclusive 형식이다', () => {
    expect(new URL(googleCalendarUrl(ev)).searchParams.get('dates')).toBe('20260720/20260723');
  });

  it('상세로 돌아올 주소를 본문에 남긴다', () => {
    expect(new URL(googleCalendarUrl(ev)).searchParams.get('details')).toContain(
      'https://popspot.co.kr/popup/10',
    );
  });
});
