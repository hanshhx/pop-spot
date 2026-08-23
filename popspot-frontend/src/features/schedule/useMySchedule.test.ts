import { describe, expect, it } from 'vitest';

import { selectMySchedule } from './useMySchedule';
import type { PopupStore } from '@/types/popup';

/**
 * "내가 본 팝업 중 곧 닫히는 것".
 *
 * <p>재방문율이 28일 기준 1.7%(2,752명 중 46명)다. 다시 올 이유가 화면에 없었다. 찜은 3주간
 * 0건인데 로그인이 필요해서다 — 그래서 로그인 없이 쌓이는 최근 방문 기록을 쓴다.
 *
 * <p>최근 방문 기록에는 <b>팝업 날짜가 없다</b>. visitedAt 은 본 시각이지 팝업 기간이 아니라서,
 * 마감일은 팝업 목록과 popupId 로 맞춰야 나온다.
 */
const p = (o: Partial<PopupStore> & { id: number; name: string }): PopupStore => ({
  location: '서울 성동구 성수동',
  status: '보통',
  viewCount: 0,
  ...o,
});

const TODAY = new Date('2026-08-23');
const v = (popupId: number) => ({ popupId });

describe('selectMySchedule', () => {
  it('본 팝업을 마감일 순으로 준다 — 오늘 마감이 맨 위다', () => {
    const popups = [
      p({ id: 1, name: '나중', endDate: '2026-09-10' }),
      p({ id: 2, name: '오늘', endDate: '2026-08-23' }),
      p({ id: 3, name: '모레', endDate: '2026-08-25' }),
    ];
    const got = selectMySchedule([v(1), v(2), v(3)], popups, TODAY);
    expect(got.map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it('본 적 없는 팝업은 안 나온다', () => {
    const popups = [p({ id: 1, name: '안 본 것', endDate: '2026-08-25' })];
    expect(selectMySchedule([], popups, TODAY)).toEqual([]);
  });

  it('목록에 없는 팝업은 조용히 건너뛴다 — 종료돼 목록에서 빠진 것이 여기로 온다', () => {
    const popups = [p({ id: 1, name: '살아 있음', endDate: '2026-08-25' })];
    const got = selectMySchedule([v(99), v(1)], popups, TODAY);
    expect(got.map((x) => x.id)).toEqual([1]);
  });

  it('이미 마감일이 지난 것은 뺀다 — 갈 수 없는 곳을 내 일정이라 부를 수 없다', () => {
    const popups = [
      p({ id: 1, name: '어제 끝남', endDate: '2026-08-22' }),
      p({ id: 2, name: '진행 중', endDate: '2026-08-25' }),
    ];
    expect(selectMySchedule([v(1), v(2)], popups, TODAY).map((x) => x.id)).toEqual([2]);
  });

  it('마감일을 모르는 것도 뺀다 — 언제 사라지는지 모르면 마감일 순 목록에 놓을 자리가 없다', () => {
    const popups = [
      p({ id: 1, name: '마감일 없음' }),
      p({ id: 2, name: '있음', endDate: '2026-08-25' }),
    ];
    expect(selectMySchedule([v(1), v(2)], popups, TODAY).map((x) => x.id)).toEqual([2]);
  });

  it('같은 팝업을 여러 번 봤어도 한 번만 나온다', () => {
    const popups = [p({ id: 1, name: '두 번 본 것', endDate: '2026-08-25' })];
    expect(selectMySchedule([v(1), v(1)], popups, TODAY)).toHaveLength(1);
  });

  it('저장소가 망가져 popupId 가 undefined 나 null 이어도 터지지 않는다', () => {
    const popups = [p({ id: 1, name: '정상', endDate: '2026-08-25' })];
    const broken = [{ popupId: undefined }, {}, null] as unknown as { popupId: number }[];
    expect(() => selectMySchedule(broken, popups, TODAY)).not.toThrow();
    expect(selectMySchedule(broken, popups, TODAY)).toEqual([]);
  });

  it('popupId 가 숫자 문자열이면 숫자로 읽는다 — 옛 저장 형식을 거부하면 이력이 조용히 사라진다', () => {
    const popups = [p({ id: 1, name: '문자열 id 로 저장된 것', endDate: '2026-08-25' })];
    const stringId = [{ popupId: '1' }] as unknown as { popupId: number }[];
    expect(selectMySchedule(stringId, popups, TODAY).map((x) => x.id)).toEqual([1]);
  });
});
