import { describe, expect, it } from 'vitest';

import {
  DISCOVER_CARD_LIMIT,
  categoryOptions,
  discoverResult,
  regionOptions,
} from './discoverOptions';
import type { PopupStore } from '@/types/popup';

/**
 * <b>고를 수 있는 것과 실제 있는 것이 어긋나면 안 된다.</b>
 *
 * <p>{@code CATEGORIES} 에는 {@code lifestyle} 이 있는데 DB 에 대응 값이 없어 어느 지역에서도
 * 0건이다. 배열을 그냥 나열하면 <b>고를 수는 있는데 항상 빈손인 선택지</b>가 생긴다.
 * 그래서 목록을 렌더 시점에 세어서 만든다 — 그러면 {@code lifestyle} 은 저절로 사라지고,
 * 앞으로 생길 어떤 불균형도 같은 방법으로 처리된다.
 *
 * <p>기획 §4.4 — "선택 조건의 재고가 없으면 조건 완화 안내를 제공하고 <b>임의의 추천을 만들지
 * 않는다.</b>"
 */

const TODAY = new Date('2026-09-09');

let seq = 0;
const popup = (over: Partial<PopupStore> = {}): PopupStore =>
  ({
    id: ++seq,
    name: '팝업',
    location: '서울 성수동',
    category: 'FASHION',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    ...over,
  }) as PopupStore;

/** 성수 × 패션 n개 */
const seongsuFashion = (n: number) => Array.from({ length: n }, () => popup());
/** 강남 × 푸드 n개 */
const gangnamFood = (n: number) =>
  Array.from({ length: n }, () => popup({ location: '서울 강남구', category: 'FOOD' }));

describe('선택지는 재고가 있는 것만', () => {
  it('재고가 0인 분야는 목록에 없다', () => {
    // lifestyle 은 DB 에 원천이 없어 항상 0건이다. 나열하면 빈손 선택지가 된다.
    const opts = categoryOptions([...seongsuFashion(3)], null, TODAY);
    expect(opts.map((o) => o.value)).not.toContain('lifestyle');
  });

  it('재고가 있는 분야는 개수와 함께 준다', () => {
    const opts = categoryOptions([...seongsuFashion(3), ...gangnamFood(2)], null, TODAY);
    expect(opts.find((o) => o.value === 'fashion')?.count).toBe(3);
    expect(opts.find((o) => o.value === 'dessert')?.count).toBe(2);
  });

  it('지역도 마찬가지다', () => {
    const opts = regionOptions([...seongsuFashion(3), ...gangnamFood(2)], null, TODAY);
    expect(opts.find((o) => o.value === 'seongsu')?.count).toBe(3);
    expect(opts.find((o) => o.value === 'gangnam')?.count).toBe(2);
    expect(opts.map((o) => o.value)).not.toContain('hongdae');
  });

  it('빈 목록이면 선택지도 없다', () => {
    expect(categoryOptions([], null, TODAY)).toEqual([]);
    expect(regionOptions([], null, TODAY)).toEqual([]);
  });
});

describe('두 축이 서로를 좁힌다 — 막다른 조합을 만들지 않는다', () => {
  it('분야를 고르면 그 분야가 있는 지역만 남는다', () => {
    const opts = regionOptions([...seongsuFashion(3), ...gangnamFood(2)], 'dessert', TODAY);
    expect(opts.map((o) => o.value)).toEqual(['gangnam']);
  });

  it('지역을 고르면 그 지역에 있는 분야만 남는다', () => {
    const opts = categoryOptions([...seongsuFashion(3), ...gangnamFood(2)], 'seongsu', TODAY);
    expect(opts.map((o) => o.value)).toEqual(['fashion']);
  });

  it('그래서 고를 수 있는 조합은 언제나 재고가 있다', () => {
    const popups = [...seongsuFashion(3), ...gangnamFood(2)];
    for (const r of regionOptions(popups, null, TODAY)) {
      for (const c of categoryOptions(popups, r.value, TODAY)) {
        expect(discoverResult(popups, r.value, c.value, [], TODAY).total).toBeGreaterThan(0);
      }
    }
  });
});

describe('결과 — 최대 6개', () => {
  it(`${DISCOVER_CARD_LIMIT}개까지만 준다`, () => {
    const r = discoverResult(seongsuFashion(20), 'seongsu', 'fashion', [], TODAY);
    expect(r.items).toHaveLength(DISCOVER_CARD_LIMIT);
    expect(r.total).toBe(20);
  });

  it('적으면 있는 만큼만 준다 — "최대" 이지 "정확히" 가 아니다', () => {
    const r = discoverResult(seongsuFashion(3), 'seongsu', 'fashion', [], TODAY);
    expect(r.items).toHaveLength(3);
  });
});

describe('넘긴 것은 빼고, 그 사실을 구분해서 말한다', () => {
  it('넘긴 팝업은 결과에 없다', () => {
    const popups = seongsuFashion(3);
    const r = discoverResult(popups, 'seongsu', 'fashion', [popups[0].id], TODAY);
    expect(r.items.map((p) => p.id)).not.toContain(popups[0].id);
    expect(r.items).toHaveLength(2);
  });

  it('다 넘기면 "재고 없음" 이 아니라 "다 넘겼음" 이다', () => {
    // 둘을 뭉뚱그리면 "조건을 완화하세요" 를 듣는다 — 조건은 멀쩡하고 자기가 다 넘긴 것인데.
    const popups = seongsuFashion(3);
    const r = discoverResult(
      popups,
      'seongsu',
      'fashion',
      popups.map((p) => p.id),
      TODAY,
    );
    expect(r.emptiness).toBe('all-skipped');
    expect(r.items).toHaveLength(0);
  });

  it('애초에 재고가 없으면 "재고 없음" 이다', () => {
    const r = discoverResult(seongsuFashion(3), 'gangnam', 'dessert', [], TODAY);
    expect(r.emptiness).toBe('no-stock');
  });

  it('보여줄 것이 있으면 none 이다', () => {
    const r = discoverResult(seongsuFashion(3), 'seongsu', 'fashion', [], TODAY);
    expect(r.emptiness).toBe('none');
  });
});

describe('재고가 없으면 조건 완화를 실제로 세어서 안내한다', () => {
  it('한 조건을 풀면 몇 곳인지 준다', () => {
    const popups = [...seongsuFashion(3), ...gangnamFood(2)];
    const r = discoverResult(popups, 'seongsu', 'dessert', [], TODAY);
    expect(r.emptiness).toBe('no-stock');
    // 지역을 풀면 강남의 푸드 2곳이 보인다.
    expect(r.relaxSuggestions.find((s) => s.field === 'region')?.count).toBe(2);
  });

  it('풀어도 0인 조건은 제안하지 않는다', () => {
    const popups = seongsuFashion(3);
    const r = discoverResult(popups, 'gangnam', 'dessert', [], TODAY);
    // 지역만 풀어도 dessert 가 0, 분야만 풀어도 강남이 0 — 제안할 것이 없다.
    expect(r.relaxSuggestions).toEqual([]);
  });
});
