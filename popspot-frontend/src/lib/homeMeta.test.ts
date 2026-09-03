import { describe, expect, it } from 'vitest';

import { CLOSING_SOON_DAYS, FALLBACK_DESCRIPTION, FALLBACK_TITLE, homeMeta } from './homeMeta';

/**
 * 검색 결과에서 <b>고를 이유</b>를 주는 문장인가.
 *
 * <p>홈은 브랜드 검색어가 0건이라 오직 일반어("서울 팝업")로만 발견된다. 그 자리에서 우리 문장에
 * 숫자가 하나도 없으면, 옆에 뜨는 블로그가 "9/10까지 성수동" 을 보여줄 때 고를 이유가 없다.
 * 실측 CTR 2.09%는 그 자리 값(4.48%)의 절반이었다.
 */
describe('homeMeta', () => {
  it('건수를 제목과 설명에 넣는다', () => {
    const { title, description } = homeMeta({ open: 462, closingSoon: 12 });

    expect(title).toContain('462곳');
    expect(description).toContain('462곳');
  });

  it('마감 임박이 있으면 밝힌다 — 지금 눌러야 할 이유다', () => {
    const { description } = homeMeta({ open: 462, closingSoon: 12 });

    expect(description).toContain('12곳');
    expect(description).toContain(`${CLOSING_SOON_DAYS}일`);
  });

  /* 없는 긴박함을 지어내면 다음에 진짜일 때 안 믿는다. */
  it('마감 임박이 없으면 그 말을 안 한다', () => {
    const { description } = homeMeta({ open: 462, closingSoon: 0 });

    expect(description).toContain('462곳');
    expect(description).not.toContain('마감');
  });

  /* "0곳" 은 클릭을 부르지 않는다. 랜딩이 0곳일 때 색인에서 빼는 것과 같은 판단이다. */
  it('열린 곳이 없으면 숫자를 안 쓴다', () => {
    expect(homeMeta({ open: 0, closingSoon: 0 })).toEqual({
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
    });
  });

  /* 숫자를 못 구했다고 홈이 죽으면 안 된다. */
  it('값이 없으면 옛 문장으로 돌아간다', () => {
    for (const bad of [null, undefined, { open: Number.NaN, closingSoon: 0 }]) {
      expect(homeMeta(bad).title).toBe(FALLBACK_TITLE);
    }
  });

  /* 검색 결과에서 잘리면 뒤쪽 정보가 사라진다. 네이버 권장 80자, 구글은 한글 기준 그 언저리다. */
  it('설명이 검색 결과에서 잘릴 만큼 길지 않다', () => {
    expect(homeMeta({ open: 1462, closingSoon: 120 }).description.length).toBeLessThanOrEqual(80);
  });

  it('제목도 마찬가지', () => {
    expect(homeMeta({ open: 1462, closingSoon: 120 }).title.length).toBeLessThanOrEqual(40);
  });
});
