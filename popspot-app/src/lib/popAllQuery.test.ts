import { describe, expect, it } from 'vitest';
import { EMPTY_POP_ALL_QUERY, POP_ALL_PAGE_SIZE, runPopAllQuery } from './popAllQuery';
import type { PopAllQuery } from './popAllQuery';
import type { PopupStore } from '@/types/popup';

const TODAY = new Date(2026, 7, 26);

function popup(id: number, overrides: Partial<PopupStore> = {}): PopupStore {
  return {
    id,
    name: '팝업 ' + id,
    location: '성수동',
    status: '',
    viewCount: 0,
    category: '패션',
    startDate: '2026-08-01',
    endDate: '2026-12-31',
    ...overrides,
  } as PopupStore;
}

function q(overrides: Partial<PopAllQuery> = {}): PopAllQuery {
  return { ...EMPTY_POP_ALL_QUERY, ...overrides };
}

const ids = (r: { items: PopupStore[] }) => r.items.map((p) => p.id);

describe('runPopAllQuery — 검색', () => {
  it('검색어가 이름에 들어 있는 팝업만 남긴다', () => {
    const pool = [popup(1, { name: '누데이크 성수' }), popup(2, { name: '무신사 스탠다드' })];
    expect(ids(runPopAllQuery(pool, q({ keyword: '누데이크' }), TODAY))).toEqual([1]);
  });

  it('검색어는 대소문자를 가리지 않는다', () => {
    const pool = [popup(1, { name: 'NUDAKE Seongsu' })];
    expect(runPopAllQuery(pool, q({ keyword: 'nudake' }), TODAY).total).toBe(1);
  });

  it('검색어는 영문 이름도 함께 본다', () => {
    // 사이트가 3개 국어를 쓰는데 한국어 이름만 검색하면 영어 화면에서 검색이 죽는다.
    const pool = [popup(1, { name: '누데이크', nameEn: 'Nudake' })];
    expect(runPopAllQuery(pool, q({ keyword: 'Nudake' }), TODAY).total).toBe(1);
  });

  it('검색어는 일본어 이름도 함께 본다', () => {
    const pool = [popup(1, { name: '누데이크', nameJa: 'ヌデイク' })];
    expect(runPopAllQuery(pool, q({ keyword: 'ヌデイク' }), TODAY).total).toBe(1);
  });

  it('검색어는 장소도 함께 본다', () => {
    const pool = [popup(1, { name: '무신사', location: '더현대 서울' })];
    expect(runPopAllQuery(pool, q({ keyword: '더현대' }), TODAY).total).toBe(1);
  });

  it('검색어 앞뒤 공백은 무시한다', () => {
    const pool = [popup(1, { name: '누데이크' })];
    expect(runPopAllQuery(pool, q({ keyword: '  누데이크  ' }), TODAY).total).toBe(1);
  });

  it('공백만 있는 검색어는 아무것도 거르지 않는다', () => {
    const pool = [popup(1), popup(2)];
    expect(runPopAllQuery(pool, q({ keyword: '   ' }), TODAY).total).toBe(2);
  });

  it('어디에도 없는 검색어는 아무것도 남기지 않는다', () => {
    const pool = [popup(1, { name: '누데이크' })];
    expect(runPopAllQuery(pool, q({ keyword: '없는이름' }), TODAY).total).toBe(0);
  });
});

describe('runPopAllQuery — 필터', () => {
  it('지역으로 거른다', () => {
    const pool = [popup(1, { location: '성수동' }), popup(2, { location: '홍대입구' })];
    expect(ids(runPopAllQuery(pool, q({ region: 'seongsu' }), TODAY))).toEqual([1]);
  });

  it('카테고리로 거른다', () => {
    const pool = [popup(1, { category: '패션' }), popup(2, { category: '뷰티' })];
    expect(ids(runPopAllQuery(pool, q({ category: 'beauty' }), TODAY))).toEqual([2]);
  });

  it('마감 임박만 골라낸다', () => {
    const pool = [popup(1, { endDate: '2026-08-28' }), popup(2, { endDate: '2026-12-31' })];
    expect(ids(runPopAllQuery(pool, q({ badge: 'closingSoon' }), TODAY))).toEqual([1]);
  });

  it('오늘 오픈만 골라낸다', () => {
    const pool = [popup(1, { startDate: '2026-08-26' }), popup(2, { startDate: '2026-08-01' })];
    expect(ids(runPopAllQuery(pool, q({ badge: 'openingToday' }), TODAY))).toEqual([1]);
  });

  it('조건 두 개를 걸면 둘 다 만족하는 것만 남는다', () => {
    const pool = [
      popup(1, { location: '성수동', category: '패션' }),
      popup(2, { location: '성수동', category: '뷰티' }),
      popup(3, { location: '홍대입구', category: '패션' }),
    ];
    expect(ids(runPopAllQuery(pool, q({ region: 'seongsu', category: 'fashion' }), TODAY))).toEqual(
      [1],
    );
  });

  it('조건이 없으면 전부 남긴다', () => {
    const pool = [popup(1), popup(2), popup(3)];
    expect(runPopAllQuery(pool, q(), TODAY).total).toBe(3);
  });
});

describe('runPopAllQuery — 정렬', () => {
  it('최신순은 시작일이 늦은 것을 앞에 둔다', () => {
    const pool = [popup(1, { startDate: '2026-08-01' }), popup(2, { startDate: '2026-08-20' })];
    expect(ids(runPopAllQuery(pool, q({ sort: 'latest' }), TODAY))).toEqual([2, 1]);
  });

  it('최신순에서 시작일을 모르는 팝업은 맨 뒤로 보낸다', () => {
    const pool = [popup(1, { startDate: undefined }), popup(2, { startDate: '2026-08-01' })];
    expect(ids(runPopAllQuery(pool, q({ sort: 'latest' }), TODAY))).toEqual([2, 1]);
  });

  it('마감임박순은 종료일이 빠른 것을 앞에 둔다', () => {
    const pool = [popup(1, { endDate: '2026-12-31' }), popup(2, { endDate: '2026-08-28' })];
    expect(ids(runPopAllQuery(pool, q({ sort: 'deadline' }), TODAY))).toEqual([2, 1]);
  });

  it('마감임박순에서 종료일을 모르는 팝업은 맨 뒤로 보낸다', () => {
    // 날짜를 모르는 것을 "가장 급한 것" 으로 올려 보내면 목록의 첫 화면이 통째로 거짓말이 된다.
    const pool = [popup(1, { endDate: undefined }), popup(2, { endDate: '2026-08-28' })];
    expect(ids(runPopAllQuery(pool, q({ sort: 'deadline' }), TODAY))).toEqual([2, 1]);
  });

  it('인기순은 조회수가 높은 것을 앞에 둔다', () => {
    const pool = [popup(1, { viewCount: 5 }), popup(2, { viewCount: 50 })];
    expect(ids(runPopAllQuery(pool, q({ sort: 'popular' }), TODAY))).toEqual([2, 1]);
  });

  it('세 정렬 모두 입력 순서가 달라져도 같은 결과를 준다', () => {
    // 크롤 팝업 다수가 viewCount=0 이고 날짜도 겹쳐 동점이 흔하다. 동점을 id 로 안정화하지
    // 않으면 페이지를 넘길 때마다 순서가 흔들려 같은 팝업을 두 번 보거나 아예 못 본다.
    const pool = Array.from({ length: 12 }, (_, i) => popup(i + 1));
    const reversed = [...pool].reverse();
    for (const sort of ['latest', 'deadline', 'popular'] as const) {
      expect(ids(runPopAllQuery(reversed, q({ sort }), TODAY))).toEqual(
        ids(runPopAllQuery(pool, q({ sort }), TODAY)),
      );
    }
  });

  it('날짜가 둘 다 없어도 순서가 무너지지 않는다', () => {
    // 없는 날짜를 Infinity 로 대신하면 둘 다 없을 때 Infinity - Infinity = NaN 이 되고,
    // 비교자가 NaN 을 돌려주면 정렬 결과는 엔진 마음대로가 된다. 마지막 항(id)이 그 자리를
    // 반드시 받아야 한다.
    const blank = { startDate: undefined, endDate: undefined };
    const pool = [popup(1, blank), popup(2, blank), popup(3, blank)];
    expect(ids(runPopAllQuery(pool, q({ sort: 'deadline' }), TODAY))).toEqual([3, 2, 1]);
    expect(ids(runPopAllQuery(pool, q({ sort: 'latest' }), TODAY))).toEqual([3, 2, 1]);
  });

  it('정렬은 필터를 통과한 것에만 적용된다', () => {
    const pool = [
      popup(1, { location: '홍대입구', viewCount: 999 }),
      popup(2, { location: '성수동', viewCount: 5 }),
      popup(3, { location: '성수동', viewCount: 50 }),
    ];
    expect(ids(runPopAllQuery(pool, q({ region: 'seongsu', sort: 'popular' }), TODAY))).toEqual([
      3, 2,
    ]);
  });
});

describe('runPopAllQuery — 페이지네이션', () => {
  const pool = Array.from({ length: POP_ALL_PAGE_SIZE * 2 + 5 }, (_, i) => popup(i + 1));

  it('한 페이지에 정해진 수만큼만 담는다', () => {
    expect(runPopAllQuery(pool, q(), TODAY).items).toHaveLength(POP_ALL_PAGE_SIZE);
  });

  it('전체 개수와 페이지 수를 함께 알려준다', () => {
    const r = runPopAllQuery(pool, q(), TODAY);
    expect(r.total).toBe(pool.length);
    expect(r.totalPages).toBe(3);
  });

  it('마지막 페이지에는 남은 만큼만 담는다', () => {
    expect(runPopAllQuery(pool, q({ page: 3 }), TODAY).items).toHaveLength(5);
  });

  it('페이지마다 서로 다른 팝업을 담는다', () => {
    // 잘라내는 자리를 잘못 계산하면 페이지가 겹치거나 사이가 비어 몇 곳이 영영 안 보인다.
    const seen = [1, 2, 3].flatMap((page) => ids(runPopAllQuery(pool, q({ page }), TODAY)));
    expect(new Set(seen).size).toBe(pool.length);
  });

  it('페이지 번호가 범위를 넘으면 마지막 페이지로 당긴다', () => {
    // 필터를 걸어 결과가 줄었을 때 빈 화면을 보여주는 대신 볼 것이 있는 곳으로 데려간다.
    const r = runPopAllQuery(pool, q({ page: 99 }), TODAY);
    expect(r.page).toBe(3);
    expect(r.items).toHaveLength(5);
  });

  it('페이지 번호가 1보다 작으면 첫 페이지로 올린다', () => {
    expect(runPopAllQuery(pool, q({ page: 0 }), TODAY).page).toBe(1);
  });

  it('결과가 없어도 페이지 수는 1이다', () => {
    const r = runPopAllQuery([], q(), TODAY);
    expect(r.totalPages).toBe(1);
    expect(r.page).toBe(1);
    expect(r.items).toEqual([]);
  });
});

describe('runPopAllQuery — 빈 결과 안내', () => {
  it('결과가 없으면 어떤 조건을 풀었을 때 몇 곳이 되는지 알려준다', () => {
    const pool = [popup(1, { location: '성수동', category: '패션' })];
    const r = runPopAllQuery(pool, q({ region: 'seongsu', category: 'beauty' }), TODAY);
    expect(r.total).toBe(0);
    expect(r.relaxSuggestions).toEqual([{ field: 'category', count: 1 }]);
  });

  it('조건을 풀어도 결과가 없으면 그 조건은 제안하지 않는다', () => {
    // "이걸 풀면 나온다" 고 해놓고 눌렀는데 또 0이면, 안내가 아니라 두 번째 막다른 길이다.
    const pool = [popup(1, { location: '성수동', category: '패션' })];
    const r = runPopAllQuery(pool, q({ region: 'hongdae', category: 'beauty' }), TODAY);
    expect(r.relaxSuggestions).toEqual([]);
  });

  it('많이 나오는 조건을 먼저 제안한다', () => {
    const pool = [
      popup(1, { location: '성수동', category: '뷰티' }),
      popup(2, { location: '홍대입구', category: '패션' }),
      popup(3, { location: '홍대입구', category: '패션' }),
    ];
    const r = runPopAllQuery(pool, q({ region: 'seongsu', category: 'fashion' }), TODAY);
    expect(r.relaxSuggestions).toEqual([
      { field: 'region', count: 2 },
      { field: 'category', count: 1 },
    ]);
  });

  it('검색어도 풀어 볼 조건에 넣는다', () => {
    const pool = [popup(1, { name: '누데이크', location: '성수동' })];
    const r = runPopAllQuery(pool, q({ keyword: '무신사', region: 'seongsu' }), TODAY);
    expect(r.relaxSuggestions).toEqual([{ field: 'keyword', count: 1 }]);
  });

  it('조건이 하나뿐이면 제안하지 않는다', () => {
    // 하나뿐인 조건을 푸는 것은 "필터 없음" 이라 제안이 아니라 초기화 버튼의 일이다.
    const pool = [popup(1, { category: '패션' })];
    const r = runPopAllQuery(pool, q({ category: 'beauty' }), TODAY);
    expect(r.total).toBe(0);
    expect(r.relaxSuggestions).toEqual([]);
  });

  it('결과가 있으면 완화 제안을 하지 않는다', () => {
    const pool = [popup(1)];
    expect(runPopAllQuery(pool, q(), TODAY).relaxSuggestions).toEqual([]);
  });
});
