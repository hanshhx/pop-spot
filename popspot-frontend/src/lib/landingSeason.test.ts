import { describe, expect, it } from 'vitest';

import { landingSeason, seasonFromSlug, slugClaimsSeason } from './landingSeason';

/** 8월. 랜딩이 "지금" 을 따르면 전부 여름이 되는 시점이다. */
const AUGUST = new Date(Date.UTC(2026, 7, 22, 3, 0, 0));

describe('seasonFromSlug', () => {
  it('달이 든 슬러그는 그 달의 계절', () => {
    // 이 시험이 이 파일의 존재 이유다 — 8월에 열어도 12월 페이지는 겨울이어야 한다.
    expect(seasonFromSlug('12월-성수')).toBe('winter');
    expect(seasonFromSlug('4월-홍대')).toBe('spring');
    expect(seasonFromSlug('7월-강남')).toBe('summer');
    expect(seasonFromSlug('10월-잠실')).toBe('autumn');
  });

  it('계절 이름이 들어가면 그대로', () => {
    expect(seasonFromSlug('winter')).toBe('winter');
    expect(seasonFromSlug('겨울-팝업')).toBe('winter');
    expect(seasonFromSlug('summer-seongsu')).toBe('summer');
  });

  it('기간과 무관한 슬러그는 계절이 없다', () => {
    // 성수는 사계절 내내 성수다. 여기에 계절을 붙이면 8월에 만든 페이지가 10월에도 우긴다.
    expect(seasonFromSlug('seongsu')).toBeNull();
    expect(seasonFromSlug('nike')).toBeNull();
    expect(seasonFromSlug('hongdae')).toBeNull();
  });

  it('달처럼 보이는 숫자를 달로 읽지 않는다', () => {
    expect(seasonFromSlug('24시간-팝업')).toBeNull();
    expect(seasonFromSlug('13월')).toBeNull();
    expect(seasonFromSlug('0월')).toBeNull();
  });
});

describe('landingSeason', () => {
  it('8월에 열어도 겨울 페이지는 겨울이다', () => {
    expect(landingSeason('12월-성수', AUGUST)).toBe('winter');
  });

  it('기간이 없으면 오늘 계절로 물러선다', () => {
    // 중립 페이지까지 계절을 안 입히면 브랜드 랜딩만 혼자 흑백처럼 보인다.
    expect(landingSeason('seongsu', AUGUST)).toBe('summer');
  });
});

describe('slugClaimsSeason', () => {
  it('배지를 달아도 되는 슬러그를 가른다', () => {
    expect(slugClaimsSeason('12월-성수')).toBe(true);
    expect(slugClaimsSeason('seongsu')).toBe(false);
  });
});
