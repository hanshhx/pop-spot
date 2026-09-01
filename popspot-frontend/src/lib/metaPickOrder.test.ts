import { describe, expect, it } from 'vitest';

import { orderForMetaDescription } from './metaPickOrder';

/**
 * 이 판정이 틀려도 화면에는 아무 증상이 없다. 잘못된 문장은 검색 결과 안에서만 며칠 서 있는다.
 * 그래서 여기서 잡지 못하면 아무 데서도 못 잡는다.
 */

const TODAY = Date.UTC(2026, 8, 1); // 2026-09-01
const MIN_DAYS = 7;
const d = (iso: string) => new Date(iso);

/** 이름만 있는 최소 항목. 순서만 보므로 그것으로 충분하다. */
const entry = (name: string, end: string | null) => ({ item: name, end: end ? d(end) : null });

const order = (entries: ReturnType<typeof entry>[]) =>
  orderForMetaDescription(entries, TODAY, MIN_DAYS).map((e) => e.item);

describe('orderForMetaDescription', () => {
  /*
   * 이 시험이 이 파일의 존재 이유다.
   *
   * 예전 구현은 순수한 마감 임박순이라 "오늘 끝나는 것" 을 제일 먼저 뽑았다. 구글이 그 설명을
   * 캐시하는 순간 거짓이 확정된다.
   */
  it('일주일 안에 끝나는 것을 앞에 두지 않는다', () => {
    expect(
      order([
        entry('오늘마감', '2026-09-01'),
        entry('내일마감', '2026-09-02'),
        entry('한달남음', '2026-09-30'),
      ]),
    ).toEqual(['한달남음', '오늘마감', '내일마감']);
  });

  /*
   * 반대 함정. "오래 남은 순" 으로 뒤집으면 상설에 가까운 매장만 뽑혀 설명이 밋밋해진다.
   * 기준을 넘긴 것들 사이에서는 임박순이 그대로 살아야 한다.
   */
  it('기준을 넘긴 것들 사이에서는 임박순을 지킨다', () => {
    expect(
      order([
        entry('일년남음', '2027-09-01'),
        entry('열흘남음', '2026-09-11'),
        entry('한달남음', '2026-09-30'),
      ]),
    ).toEqual(['열흘남음', '한달남음', '일년남음']);
  });

  it('여유 있는 것이 없으면 임박한 것으로 채운다 — 빈 설명보다 낫다', () => {
    expect(order([entry('내일마감', '2026-09-02'), entry('오늘마감', '2026-09-01')])).toEqual([
      '오늘마감',
      '내일마감',
    ]);
  });

  /* 마감을 모르면 설명에 마감이 안 붙는다. 누를 이유가 가장 약하므로 언제나 맨 뒤다. */
  it('마감을 모르는 것은 항상 맨 뒤다', () => {
    expect(
      order([
        entry('모름', null),
        entry('오늘마감', '2026-09-01'),
        entry('한달남음', '2026-09-30'),
      ]),
    ).toEqual(['한달남음', '오늘마감', '모름']);
  });

  it('여유 있는 것이 없어도 마감 모르는 것보다는 임박한 것이 앞이다', () => {
    expect(order([entry('모름', null), entry('내일마감', '2026-09-02')])).toEqual([
      '내일마감',
      '모름',
    ]);
  });

  it('경계 — 정확히 기준일에 끝나는 것은 여유 있는 쪽이다', () => {
    expect(order([entry('오늘마감', '2026-09-01'), entry('딱7일', '2026-09-08')])).toEqual([
      '딱7일',
      '오늘마감',
    ]);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const input = [entry('b', '2026-09-30'), entry('a', '2026-09-01')];
    const copy = [...input];
    orderForMetaDescription(input, TODAY, MIN_DAYS);
    expect(input).toEqual(copy);
  });

  it('빈 입력은 빈 결과', () => {
    expect(order([])).toEqual([]);
  });
});
