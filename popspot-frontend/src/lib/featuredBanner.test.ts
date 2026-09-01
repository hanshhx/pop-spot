import { describe, expect, it } from 'vitest';

import {
  daysUntilStart,
  pickFeatured,
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
