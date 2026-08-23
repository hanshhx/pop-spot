// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PopupStore } from '@/types/popup';
import type { RecentVisit } from '@/lib/recentVisits';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'ko' }),
}));

const readVisitsMock = vi.fn<() => RecentVisit[]>();
vi.mock('@/lib/recentVisits', () => ({
  readVisits: () => readVisitsMock(),
}));

import { MySchedule } from './MySchedule';

/**
 * "지어낸 일정을 남의 달력에 넣는 것은 정보가 없는 것보다 나쁘다" — 이 규칙 하나가
 * {@code canSave} 라는 한 줄짜리 식으로만 지켜지고 있다.
 *
 * <p>{@code toCalendarEvent} 는 {@code startDate} 와 {@code endDate} 가 <b>둘 다</b> 있어야
 * 이벤트를 만든다. 종료일만 있고 시작일이 없는 팝업은 {@link selectMySchedule}(마감일만 본다)은
 * 통과시키지만 저장 버튼은 없어야 한다 — {@code canSave = Boolean(popup.endDate)} 처럼 그럴듯해
 * 보이는 리팩터가 이 줄을 대신하면 조용히 가짜 일정을 만들기 시작한다.
 *
 * <p>기록이 없을 때 <b>아무것도 그리지 않는다</b>는 것도 같은 무게로 지킨다 — 검색으로 들어와
 * 이력이 없는 사람에게 빈 카드를 보여주는 것은 탭이 존재할 이유를 없앤다.
 */
const p = (o: Partial<PopupStore> & { id: number; name: string }): PopupStore => ({
  location: '서울 성동구 성수동',
  status: '보통',
  viewCount: 0,
  ...o,
});

const v = (popupId: number): RecentVisit => ({
  popupId,
  popupName: `popup-${popupId}`,
  visitedAt: '2026-01-01T00:00:00.000Z',
});

afterEach(() => {
  document.body.innerHTML = '';
  readVisitsMock.mockReset();
});

describe('MySchedule', () => {
  it('시작일·종료일이 둘 다 있는 팝업에만 저장 버튼이 뜬다 — 종료일만 있는 것은 뜨지 않는다', async () => {
    const popups = [
      p({ id: 1, name: '둘 다 있음', startDate: '2099-01-01', endDate: '2099-01-10' }),
      p({ id: 2, name: '종료일만 있음', endDate: '2099-02-10' }),
    ];
    readVisitsMock.mockReturnValue([v(1), v(2)]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MySchedule popups={popups} />);
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute('aria-label')).toContain('둘 다 있음');

    await act(async () => {
      root.unmount();
    });
  });

  it('본 기록이 없으면 아무것도 그리지 않는다 — 빈 카드조차 그리지 않는다', async () => {
    const popups = [p({ id: 1, name: '아무도 안 본 것', endDate: '2099-01-10' })];
    readVisitsMock.mockReturnValue([]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MySchedule popups={popups} />);
    });

    expect(container.innerHTML).toBe('');

    await act(async () => {
      root.unmount();
    });
  });
});
