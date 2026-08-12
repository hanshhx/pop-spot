import { describe, expect, it } from 'vitest';

import { fitWithinBudget, MAX_FEED_BYTES } from '../../../app/feed.xml/route';

/**
 * RSS 피드를 <b>건수가 아니라 크기</b>로 자른다.
 *
 * <p>2026-08-12 서치어드바이저 기준 네이버 색인이 43건인데 피드가 60건이었다. 사이트맵에는 분류 랜딩만
 * 173건을 내고 있었는데도 색인이 피드 크기에 붙어 있었다 — 네이버가 보는 재고가 사실상 이 피드라는 뜻이다.
 *
 * <p>같은 기간 구글은 297건을 색인해 클릭이 11배였다. 순위 문제가 아니라 보여준 게 없어서였다.
 */
describe('fitWithinBudget', () => {
  const render = (s: string) => s;

  it('예산 안에 들어가는 만큼 담는다', () => {
    // 10바이트짜리 5개 = 50바이트. 예산 35면 3개까지.
    const items = ['a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10), 'd'.repeat(10)];

    expect(fitWithinBudget(items, 35, render)).toEqual([items[0], items[1], items[2]]);
  });

  /**
   * 호출자가 최신순으로 넘기므로 앞에서부터 채워야 한다. 뒤에서 자르면 최신 글이 떨어져 나가 RSS 가 맡은
   * "최근에 뭐가 바뀌었나" 신호가 뒤집힌다.
   */
  it('앞에서부터 채운다 — 잘리는 것은 늘 오래된 쪽이다', () => {
    const items = ['최신', '중간', '오래됨'];

    expect(fitWithinBudget(items, 12, render)).toEqual(['최신', '중간']);
  });

  it('예산이 넉넉하면 전부 담는다', () => {
    const items = ['a', 'b', 'c'];

    expect(fitWithinBudget(items, MAX_FEED_BYTES, render)).toEqual(items);
  });

  /**
   * 한글은 UTF-8 에서 글자당 3바이트다. 문자열 길이로 재면 실제 크기를 3분의 1로 잘못 본다 — 슬라이스
   * 제목이 전부 한글이라 이 차이가 그대로 어긋난 값이 된다.
   */
  it('한글을 바이트로 센다 — 글자 수로 재면 3배 어긋난다', () => {
    const korean = '성수'; // 6바이트

    expect(fitWithinBudget([korean, korean], 6, render)).toEqual([korean]);
    expect(fitWithinBudget([korean, korean], 12, render)).toEqual([korean, korean]);
  });

  it('첫 항목이 예산을 넘으면 빈 배열이다 — 넘겨서 거부당하느니 비운다', () => {
    expect(fitWithinBudget(['x'.repeat(100)], 10, render)).toEqual([]);
  });
});
