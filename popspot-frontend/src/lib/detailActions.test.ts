import { describe, expect, it } from 'vitest';

import { showsVisitActions } from './detailActions';

const TODAY = new Date('2026-08-25T00:00:00+09:00');

describe('showsVisitActions', () => {
  it('진행 중인 팝업에는 방문 액션을 보여준다', () => {
    expect(showsVisitActions('2026-08-01', '2026-08-31', TODAY)).toBe(true);
  });

  it('이미 끝난 팝업에는 방문 액션을 보여주지 않는다 — 닫힌 곳으로 사람을 보내는 버튼이다', () => {
    expect(showsVisitActions('2026-07-01', '2026-08-12', TODAY)).toBe(false);
  });

  it('아직 열지 않은 팝업에도 보여준다 — 갈 수 있는 곳이고 일정에 담을 수 있다', () => {
    expect(showsVisitActions('2026-09-01', '2026-09-30', TODAY)).toBe(true);
  });

  it('날짜를 모르면 보여준다 — 끝났다는 증거가 없는데 숨기면 멀쩡한 팝업이 사라진다', () => {
    expect(showsVisitActions(null, null, TODAY)).toBe(true);
  });

  it('종료일 당일에는 아직 보여준다 — 그날은 아직 열려 있다', () => {
    expect(showsVisitActions('2026-08-01', '2026-08-25', TODAY)).toBe(true);
  });
});
