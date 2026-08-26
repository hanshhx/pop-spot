import { describe, expect, it } from 'vitest';
import { popupBadge } from './popupBadges';

// kstTodayStart() 가 돌려주는 것과 같은 모양 — '로컬 자정으로 표현한 달력 날짜'.
const TODAY = new Date(2026, 7, 26);

describe('popupBadge', () => {
  it('오늘 문을 연 팝업에는 오늘 오픈 배지를 준다', () => {
    expect(popupBadge('2026-08-26', '2026-09-30', TODAY)).toEqual({ kind: 'openingToday' });
  });

  it('사흘 안에 끝나는 팝업에는 남은 날짜와 함께 마감 배지를 준다', () => {
    expect(popupBadge('2026-08-01', '2026-08-29', TODAY)).toEqual({
      kind: 'closingSoon',
      dday: 3,
    });
  });

  it('오늘 끝나는 팝업의 남은 날짜는 0이다', () => {
    expect(popupBadge('2026-08-01', '2026-08-26', TODAY)).toEqual({
      kind: 'closingSoon',
      dday: 0,
    });
  });

  it('오늘 열고 사흘 안에 닫는 팝업은 오늘 오픈이 아니라 마감 배지를 단다', () => {
    // 둘 다 해당할 때 무엇을 보여줄지는 취향이 아니라 행동의 문제다 — 마감이 사람의
    // 계획을 바꾸고, 오늘 열었다는 사실은 바꾸지 않는다.
    expect(popupBadge('2026-08-26', '2026-08-27', TODAY)).toEqual({
      kind: 'closingSoon',
      dday: 1,
    });
  });

  it('아직 열지 않은 팝업에는 며칠 뒤에 여는지를 준다', () => {
    expect(popupBadge('2026-08-30', '2026-09-30', TODAY)).toEqual({
      kind: 'upcoming',
      opensIn: 4,
    });
  });

  it('나흘 남은 팝업은 마감 임박이 아니다', () => {
    // 사흘(위 테스트)과 나흘을 <b>둘 다</b> 확인해야 경계가 고정된다. 하나만 있으면
    // CLOSING_SOON_DAYS 를 3에서 7로 바꿔도 아무 테스트도 실패하지 않는다(실측으로 확인했다).
    expect(popupBadge('2026-08-01', '2026-08-30', TODAY)).toBeNull();
  });

  it('한참 남은 팝업에는 배지를 주지 않는다', () => {
    expect(popupBadge('2026-08-01', '2026-12-31', TODAY)).toBeNull();
  });

  it('이미 끝난 팝업에는 배지를 주지 않는다', () => {
    expect(popupBadge('2026-07-01', '2026-08-25', TODAY)).toBeNull();
  });

  it('끝난 팝업은 오늘 시작했더라도 배지를 주지 않는다', () => {
    // 위 테스트만으로는 <b>끝남 판정이 실제로 일을 하는지</b> 알 수 없다. 그 분기를 지워도
    // 통과하기 때문이다 — ended 상태에는 dday 가 아예 없어 마감 배지로 새지 않고, 시작일도
    // 오늘이 아니라 오늘 오픈으로도 새지 않는다. 통과하지만 아무것도 지키지 않는다.
    //
    // <p>시작일이 오늘인 끝난 팝업이라야 그 분기가 유일한 방어선이 된다 — 없으면 어제 문을
    // 닫은 팝업에 「오늘 오픈」이 붙는다.
    expect(popupBadge('2026-08-26', '2026-08-25', TODAY)).toBeNull();
  });

  it('종료일을 모르는 상시 운영 팝업에는 배지를 주지 않는다', () => {
    // 날짜를 모르는 것은 급하다는 뜻이 아니다. 모를 때 급한 척하는 배지가 가장 나쁘다.
    expect(popupBadge('2026-08-01', null, TODAY)).toBeNull();
  });

  it('시작일을 모르면 오늘 오픈이라고 주장하지 않는다', () => {
    expect(popupBadge(null, '2026-12-31', TODAY)).toBeNull();
  });
});
