import { describe, expect, it } from 'vitest';

import { landingStatus } from './landingStatus';

/**
 * 랜딩 목록의 팝업이 지금 어떤 상태인가.
 *
 * <p>예전에는 종료일만 봤다. 그래서 <b>아직 열지도 않은</b> 팝업이 라임색 '진행 중' 배지를 달았다 —
 * 닷새 뒤에 열고 서른 날 뒤에 닫는 팝업은 남은 날이 30 이라 "여유 있게 진행 중" 으로 읽혔다.
 * 검색으로 들어온 사람에게 그건 "지금 가면 된다" 는 말이다.
 *
 * <p>날짜를 두 개 다 보면 세 가지로 갈린다. 그 경계를 여기서 고정한다.
 */
const TODAY = new Date('2026-08-24');

describe('landingStatus', () => {
  it('아직 열지 않았으면 upcoming 이고 며칠 남았는지 함께 준다', () => {
    expect(landingStatus('2026-08-29', '2026-09-23', TODAY)).toEqual({
      kind: 'upcoming',
      opensIn: 5,
    });
  });

  it('오늘 여는 것은 upcoming 이 아니라 ongoing 이다 — 오늘부터 갈 수 있다', () => {
    expect(landingStatus('2026-08-24', '2026-09-23', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 30,
    });
  });

  it('이미 열려 있으면 ongoing 이고 마감까지 남은 날을 준다', () => {
    expect(landingStatus('2026-08-01', '2026-08-26', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 2,
    });
  });

  it('마감일이 지났으면 ended 다', () => {
    expect(landingStatus('2026-08-01', '2026-08-23', TODAY)).toEqual({
      kind: 'ended',
    });
  });

  it('시작일을 모르면 열려 있는 것으로 본다 — 목록에 있다는 것 자체가 진행 중이라는 뜻이다', () => {
    expect(landingStatus(null, '2026-09-23', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 30,
    });
  });

  it('종료일을 모르면 ongoing 이되 남은 날은 null 이다 — 상시 운영이 이렇게 들어온다', () => {
    expect(landingStatus('2026-08-01', null, TODAY)).toEqual({
      kind: 'ongoing',
      dday: null,
    });
  });

  it('둘 다 모르면 ongoing 이다', () => {
    expect(landingStatus(null, null, TODAY)).toEqual({
      kind: 'ongoing',
      dday: null,
    });
  });

  it('읽을 수 없는 날짜는 없는 것으로 친다 — 크롤링 원문이 그대로 들어온다', () => {
    expect(landingStatus('내일부터', '2026-09-23', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 30,
    });
  });
});
