import { describe, expect, it } from 'vitest';

import {
  daysUntilStart,
  pickAll,
  pickAllForPage,
  pickFeatured,
  pickForPage,
  SHOW_DAYS_BEFORE,
  type FeaturedPopup,
} from './featuredBanner';

/**
 * 배너가 남는 사고는 "누가 내리는 것을 잊어서" 난다. 그래서 여기서 확인하는 것은 <b>뜨는가</b>
 * 보다 <b>스스로 사라지는가</b> 쪽이다.
 */

const ENTRY: FeaturedPopup = {
  popupId: 1234,
  title: '2026 제주 로컬브랜드 팝업스토어',
  place: '성수 · KT&G 상상플래닛',
  imageUrl: '/partner/jeju-2026/01.webp',
  startDate: '2026-09-05',
  endDate: '2026-09-06',
};

const at = (day: string) => new Date(`${day}T12:00:00+09:00`);

describe('pickFeatured', () => {
  it('시작 며칠 전에는 띄운다', () => {
    expect(pickFeatured(ENTRY, at('2026-09-01'))).not.toBeNull();
  });

  it('행사 중에는 띄운다', () => {
    expect(pickFeatured(ENTRY, at('2026-09-05'))).not.toBeNull();
    expect(pickFeatured(ENTRY, at('2026-09-06'))).not.toBeNull();
  });

  /*
   * 이 검사가 이 파일의 존재 이유다. 끝난 팝업 배너가 홈 맨 위에 남아 있으면 사이트 전체가
   * 관리되지 않는 것처럼 보인다 — 실제로 정보는 하루만 늙어도 그렇게 읽힌다.
   */
  it('끝난 다음 날에는 저절로 사라진다', () => {
    expect(pickFeatured(ENTRY, at('2026-09-07'))).toBeNull();
    expect(pickFeatured(ENTRY, at('2026-10-01'))).toBeNull();
  });

  /* 마지막 날 저녁에 문을 닫아도 그날 하루는 남는다. 이미 가는 중인 사람에게 필요하다. */
  it('마지막 날 밤에도 그날 안에는 남는다', () => {
    expect(pickFeatured(ENTRY, new Date('2026-09-06T23:30:00+09:00'))).not.toBeNull();
  });

  it('너무 이르면 안 띄운다', () => {
    const justInside = at('2026-09-05');
    justInside.setDate(justInside.getDate() - SHOW_DAYS_BEFORE);
    expect(pickFeatured(ENTRY, justInside)).not.toBeNull();

    const tooEarly = at('2026-09-05');
    tooEarly.setDate(tooEarly.getDate() - SHOW_DAYS_BEFORE - 1);
    expect(pickFeatured(ENTRY, tooEarly)).toBeNull();
  });

  /* 등록 SQL 전에는 id 가 없다. 눌러도 아무 데도 안 가는 배너를 띄우느니 안 띄운다. */
  it('팝업 id 가 없으면 안 띄운다', () => {
    expect(pickFeatured({ ...ENTRY, popupId: null }, at('2026-09-05'))).toBeNull();
  });

  it('날짜가 이상해도 터지지 않는다', () => {
    expect(pickFeatured({ ...ENTRY, endDate: '' }, at('2026-09-05'))).toBeNull();
    expect(pickFeatured({ ...ENTRY, endDate: '언제까지' }, at('2026-09-05'))).toBeNull();
  });
});

describe('daysUntilStart', () => {
  it('시작 전이면 남은 날을 센다', () => {
    expect(daysUntilStart(ENTRY, at('2026-09-01'))).toBe(4);
    expect(daysUntilStart(ENTRY, at('2026-09-04'))).toBe(1);
  });

  /* 시작 당일부터는 'D-0' 이 아니라 '진행 중' 으로 말해야 한다. */
  it('시작했으면 세지 않는다', () => {
    expect(daysUntilStart(ENTRY, at('2026-09-05'))).toBeNull();
    expect(daysUntilStart(ENTRY, at('2026-09-06'))).toBeNull();
  });
});

/**
 * 배너를 여러 화면에 띄우면서 생긴 규칙 — <b>자기 자신 위에는 안 뜬다.</b>
 *
 * <p>홈·랜딩·상세 어디에나 같은 배너가 뜨는데, 그 배너가 가리키는 상세에 들어간 순간에도
 * 그대로 남으면 눌러도 화면이 안 바뀐다. 사용자에게는 링크가 죽은 것으로 보인다.
 */
describe('pickForPage', () => {
  const 행사중 = at('2026-09-05');

  it('다른 팝업 상세에서는 띄운다', () => {
    expect(pickForPage(ENTRY, 9999, 행사중)).not.toBeNull();
  });

  it('자기 자신의 상세에서는 안 띄운다', () => {
    expect(pickForPage(ENTRY, 1234, 행사중)).toBeNull();
  });

  /* 라우트 파라미터는 문자열, 객체 필드는 숫자로 온다. 둘 다 같은 답이어야 한다. */
  it('id 가 문자열로 와도 같은 답을 낸다', () => {
    expect(pickForPage(ENTRY, '1234', 행사중)).toBeNull();
    expect(pickForPage(ENTRY, '9999', 행사중)).not.toBeNull();
  });

  it('id 를 안 주는 화면(홈·랜딩)에서는 그냥 띄운다', () => {
    expect(pickForPage(ENTRY, null, 행사중)).not.toBeNull();
    expect(pickForPage(ENTRY, undefined, 행사중)).not.toBeNull();
  });

  /* 기간 판정이 우선이다 — 자기 상세가 아니어도 끝났으면 안 뜬다. */
  it('기간이 끝났으면 어느 화면에서도 안 띄운다', () => {
    expect(pickForPage(ENTRY, 9999, at('2026-09-07'))).toBeNull();
  });
});

/**
 * 여러 건이 겹치는 동안 <b>둘 다</b> 뜬다.
 *
 * <p>한 건짜리 상수였을 때는 새 건이 들어오면 갈아 끼워야 했고, 그러면 아직 열려 있는 팝업이
 * 배너에서 사라졌다. 2026-09-05 에 제주(~09-06)가 하루 남은 상태로 릴 건(09-15~23)이 들어와
 * 실제로 그 상황이 됐다.
 */
describe('pickAll — 겹치는 동안 여러 줄', () => {
  const 제주: FeaturedPopup = { ...ENTRY };
  const 릴: FeaturedPopup = {
    popupId: 5678,
    title: '릴 X 토니노 람보르기니 GROUND',
    place: '성수 · 성수이로 72',
    imageUrl: '/partner/lil-lamborghini-2026/01.webp',
    startDate: '2026-09-15',
    endDate: '2026-09-23',
  };
  const 목록 = [제주, 릴];

  it('둘 다 기간에 걸리면 둘 다 띄운다', () => {
    expect(pickAll(목록, at('2026-09-05')).map((e) => e.popupId)).toEqual([1234, 5678]);
  });

  /* 곧 닫히는 쪽이 위다 — 2주 남은 건은 다음에 봐도 되지만 내일 끝나는 건은 오늘이 마지막이다. */
  it('끝나는 순서대로 준다 — 목록에 적은 순서가 아니라', () => {
    expect(pickAll([릴, 제주], at('2026-09-05')).map((e) => e.endDate)).toEqual([
      '2026-09-06',
      '2026-09-23',
    ]);
  });

  it('끝난 것만 빠지고 나머지는 남는다', () => {
    expect(pickAll(목록, at('2026-09-16')).map((e) => e.popupId)).toEqual([5678]);
  });

  it('아직 아무것도 시작 근처가 아니면 빈 배열이다', () => {
    expect(pickAll(목록, at('2026-08-01'))).toEqual([]);
  });

  /* 등록 SQL 전이라 id 가 없는 줄은 눌러도 갈 곳이 없다. 그 줄만 빠지고 나머지는 뜬다. */
  it('id 가 없는 줄만 빠진다', () => {
    const 미등록 = { ...릴, popupId: null };
    expect(pickAll([제주, 미등록], at('2026-09-05')).map((e) => e.popupId)).toEqual([1234]);
  });
});

describe('pickAllForPage — 보고 있는 팝업 줄만 뺀다', () => {
  const 제주: FeaturedPopup = { ...ENTRY };
  const 릴: FeaturedPopup = {
    popupId: 5678,
    title: '릴 X 토니노 람보르기니 GROUND',
    place: '성수 · 성수이로 72',
    imageUrl: '/partner/lil-lamborghini-2026/01.webp',
    startDate: '2026-09-15',
    endDate: '2026-09-23',
  };
  const 목록 = [제주, 릴];
  const 행사중 = at('2026-09-05');

  /*
   * 한 건짜리였을 때와 갈라지는 지점이다. 그때는 "내 상세면 배너가 통째로 사라진다" 였는데,
   * 이제는 <b>그 줄만</b> 빠지고 다른 팝업 줄은 남아야 한다 — 남은 줄은 여전히 갈 곳이 있다.
   */
  it('자기 상세에서는 자기 줄만 빠지고 다른 줄은 남는다', () => {
    expect(pickAllForPage(목록, 1234, 행사중).map((e) => e.popupId)).toEqual([5678]);
  });

  it('id 가 문자열로 와도 같은 답을 낸다', () => {
    expect(pickAllForPage(목록, '5678', 행사중).map((e) => e.popupId)).toEqual([1234]);
  });

  it('id 를 안 주는 화면에서는 전부 띄운다', () => {
    expect(pickAllForPage(목록, null, 행사중)).toHaveLength(2);
    expect(pickAllForPage(목록, undefined, 행사중)).toHaveLength(2);
  });
});
