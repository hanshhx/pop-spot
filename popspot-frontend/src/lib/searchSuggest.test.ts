import { describe, expect, it } from 'vitest';

import { rankSuggestions, SUGGEST_LIMIT, suggestScore } from './searchSuggest';

/**
 * 이 검사가 지키는 것은 <b>자르기 전에 정렬한다</b> 는 한 가지다.
 *
 * <p>2026-09-02 에 「2026 제주 로컬브랜드 팝업스토어」가 "제주" 검색에서 안 보였다. 걸린 것은
 * 아홉 곳이었는데 앞에서 여섯을 그냥 잘랐고, 그 여섯을 주소에 「제주공항」이 든 지브리 팝업들이
 * 채웠다. 사용자에게는 "그 팝업이 없다" 로 보인다 — 고장이 빈 결과로 위장하는 부류다.
 */

/** 실제로 그날 화면에 뜬 여섯 곳 + 밀려난 진짜 답. 순서도 그때 그대로다. */
const 그날_목록 = [
  { name: '도토리숲 지브리 팝업스토어', location: '서울 제주국제공항 도착층 3번 게이트앞' },
  { name: '제주 토토로 팝업스토어', location: '서울' },
  { name: '스토시', location: '서울 제주특별자치도' },
  { name: '도토리숲 팝업스토어', location: '서울 제주공항' },
  { name: '오롱마차 제주말차', location: '서울 용산역 아이파크몰 3층' },
  { name: '스튜디오 지브리 팝업스토어', location: '서울 제주공항' },
  { name: '2026 제주 로컬브랜드 팝업스토어', location: '서울 성동구 KT&G 상상플래닛' },
];

describe('rankSuggestions', () => {
  /* 이 파일의 존재 이유. 목록 맨 뒤에 있어도 이름으로 걸렸으면 올라와야 한다. */
  it('이름으로 걸린 것은 주소로만 걸린 것보다 앞에 온다 — 목록 맨 뒤에 있어도', () => {
    const 추천 = rankSuggestions(그날_목록, '제주');

    expect(추천).toHaveLength(SUGGEST_LIMIT);
    expect(추천.map((p) => p.name)).toContain('2026 제주 로컬브랜드 팝업스토어');
  });

  it('이름이 검색어로 시작하는 것이 가장 앞에 온다', () => {
    expect(rankSuggestions(그날_목록, '제주')[0].name).toBe('제주 토토로 팝업스토어');
  });

  /* 주소로만 걸린 것을 버리지는 않는다 — "성수" 는 대개 이름이 아니라 주소에 있다. */
  it('주소로만 걸린 것도 남긴다', () => {
    const 추천 = rankSuggestions(그날_목록, '제주', 10);

    expect(추천.map((p) => p.name)).toContain('스토시');
  });

  it('개수를 넘겨 주지 않는다', () => {
    const 여덟곳 = Array.from({ length: 8 }, (_, i) => ({ name: `성수 팝업 ${i}` }));

    expect(rankSuggestions(여덟곳, '성수')).toHaveLength(SUGGEST_LIMIT);
    expect(rankSuggestions(여덟곳, '성수', 2)).toHaveLength(2);
  });

  /* 같은 점수끼리 순서가 흔들리면, 글자를 지웠다 다시 쳤을 때 추천이 춤춘다. */
  it('동점이면 원래 차례를 지킨다', () => {
    const 동점 = [
      { name: '가 팝업', location: '서울' },
      { name: '나 팝업', location: '서울' },
      { name: '다 팝업', location: '서울' },
    ];

    expect(rankSuggestions(동점, '팝업').map((p) => p.name)).toEqual([
      '가 팝업',
      '나 팝업',
      '다 팝업',
    ]);
  });

  it('번역명·번역주소로도 걸린다', () => {
    const 목록 = [{ name: '산리오 팝업', nameEn: 'Sanrio Pop-up', locationEn: 'Seongsu' }];

    expect(rankSuggestions(목록, 'sanrio')).toHaveLength(1);
    expect(rankSuggestions(목록, 'seongsu')).toHaveLength(1);
  });

  it('대소문자를 가리지 않는다', () => {
    expect(rankSuggestions([{ name: 'AHRO 팝업' }], 'ahro')).toHaveLength(1);
  });

  it('검색어가 비었거나 목록이 없으면 빈 목록', () => {
    expect(rankSuggestions(그날_목록, '')).toEqual([]);
    expect(rankSuggestions(그날_목록, '   ')).toEqual([]);
    expect(rankSuggestions([], '제주')).toEqual([]);
    expect(rankSuggestions(undefined, '제주')).toEqual([]);
    expect(rankSuggestions(null, '제주')).toEqual([]);
  });

  it('아무것도 안 걸리면 빈 목록 — 억지로 채우지 않는다', () => {
    expect(rankSuggestions(그날_목록, '부산')).toEqual([]);
  });
});

describe('suggestScore', () => {
  it('이름 앞부분 > 이름 어딘가 > 주소에만 > 안 걸림', () => {
    const 앞부분 = suggestScore({ name: '제주 팝업' }, '제주');
    const 어딘가 = suggestScore({ name: '2026 제주 팝업' }, '제주');
    const 주소만 = suggestScore({ name: '지브리', location: '서울 제주공항' }, '제주');
    const 없음 = suggestScore({ name: '지브리', location: '서울' }, '제주');

    expect(앞부분).toBeGreaterThan(어딘가);
    expect(어딘가).toBeGreaterThan(주소만);
    expect(주소만).toBeGreaterThan(없음);
    expect(없음).toBe(0);
  });

  /* 이름에 걸렸으면 주소 점수를 <b>더하지</b> 않는다 — 더하면 "제주 팝업(서울 제주공항)" 같은
     드문 조합이 이름 앞부분 일치를 눌러 버린다. */
  it('가장 좋은 자리 하나로만 점수를 매긴다', () => {
    const 둘다 = suggestScore({ name: '제주 팝업', location: '서울 제주공항' }, '제주');
    const 이름만 = suggestScore({ name: '제주 팝업', location: '서울' }, '제주');

    expect(둘다).toBe(이름만);
  });

  it('빈 검색어는 0', () => {
    expect(suggestScore({ name: '제주 팝업' }, '')).toBe(0);
  });
});
