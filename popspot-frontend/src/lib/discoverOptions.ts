import { EMPTY_POP_ALL_QUERY, runPopAllQuery, type RelaxSuggestion } from './popAllQuery';
import { CATEGORIES, type CategoryCode } from './popupSlices';
import { REGIONS, type RegionCode } from './regions';
import type { PopupStore } from '@/types/popup';

/**
 * 발견의 취향 탐색 — <b>고를 수 있는 것과 실제 있는 것을 어긋나지 않게</b> 한다.
 *
 * <p><b>왜 목록을 세어서 만드나.</b> {@code CATEGORIES} 에는 {@code lifestyle} 이 있는데 DB 가
 * 쓰는 category 값(FASHION·FOOD·CHARACTER·BEAUTY·CULTURE·ETC·TECH) 중 어느 것도 그리로
 * 매칭되지 않아 <b>전 지역 0건</b>이다(2026-09-09 실측). 배열을 그냥 나열하면 고를 수는 있는데
 * 항상 빈손인 선택지가 생긴다. 렌더 시점에 세면 그것이 저절로 사라지고, 앞으로 생길 어떤
 * 불균형도 같은 방법으로 처리된다.
 *
 * <p><b>두 축이 서로를 좁힌다.</b> 분야를 고르면 그 분야가 있는 지역만 남고, 그 반대도 같다.
 * 그래서 <b>고를 수 있는 조합에는 언제나 재고가 있다</b> — 막다른 길을 만들지 않는다.
 *
 * <p>거르는 일은 {@link runPopAllQuery} 에 맡긴다. 선택지를 세는 규칙과 결과를 고르는 규칙이
 * 갈라지면 "고를 수 있는데 눌러 보니 없는" 조합이 생긴다.
 */

/** 기획 §4.4 — "최대 6개 카드". <b>최대</b>이지 정확히가 아니다. 3건이면 3장을 그린다. */
export const DISCOVER_CARD_LIMIT = 6;

export interface DiscoverOption<T> {
  value: T;
  /** 지금 다른 축의 선택을 반영한 실제 개수. */
  count: number;
}

/** 넘긴 것 때문에 빈 것과 애초에 없는 것을 가른다({@code SavedEmptiness} 와 같은 어휘). */
export type DiscoverEmptiness =
  /** 보여줄 것이 있다. */
  | 'none'
  /** 재고는 있는데 <b>이번 탐색에서 다 넘겼다.</b> */
  | 'all-skipped'
  /** 이 조합에 애초에 재고가 없다. */
  | 'no-stock';

export interface DiscoverResult {
  items: PopupStore[];
  /** 넘기기 전 전체 수. 화면이 "3곳 중 2곳" 을 말할 수 있게 한다. */
  total: number;
  emptiness: DiscoverEmptiness;
  relaxSuggestions: RelaxSuggestion[];
}

/**
 * 조건 하나로 세는 공통 경로.
 *
 * <p>정렬을 {@code deadline} 로 고정한다 — 마이팝의 저장 목록도, 비교도 마감 급한 순이다.
 * 같은 데이터가 화면마다 다른 순서로 보이면 안 된다.
 */
function query(region: RegionCode | null, category: CategoryCode | null) {
  return { ...EMPTY_POP_ALL_QUERY, region, category, sort: 'deadline' as const };
}

function countOf(
  popups: PopupStore[],
  region: RegionCode | null,
  category: CategoryCode | null,
  today: Date,
): number {
  return runPopAllQuery(popups, query(region, category), today).total;
}

/** 지금 고른 분야에서 <b>재고가 있는 지역만</b>. 개수가 큰 순이 아니라 정의 순서를 따른다. */
export function regionOptions(
  popups: PopupStore[],
  category: CategoryCode | null,
  today: Date,
): DiscoverOption<RegionCode>[] {
  const codes: RegionCode[] = [...REGIONS.map((r) => r.code), 'other'];
  return codes
    .map((value) => ({ value, count: countOf(popups, value, category, today) }))
    .filter((o) => o.count > 0);
}

/** 지금 고른 지역에서 <b>재고가 있는 분야만</b>. */
export function categoryOptions(
  popups: PopupStore[],
  region: RegionCode | null,
  today: Date,
): DiscoverOption<CategoryCode>[] {
  const codes: CategoryCode[] = [...CATEGORIES.map((c) => c.code), 'other'];
  return codes
    .map((value) => ({ value, count: countOf(popups, region, value, today) }))
    .filter((o) => o.count > 0);
}

/**
 * 카드로 그릴 것을 통째로 계산한다.
 *
 * <p><b>넘긴 것 때문에 빈 것과 애초에 없는 것을 가른다.</b> 둘을 뭉뚱그리면 사용자가
 * "조건을 완화하세요" 를 듣는다 — 조건은 멀쩡하고 자기가 다 넘긴 것인데.
 *
 * @param skipped 이번 탐색에서 넘긴 id({@code discoverySkips}).
 */
export function discoverResult(
  popups: PopupStore[],
  region: RegionCode | null,
  category: CategoryCode | null,
  skipped: readonly number[],
  today: Date,
): DiscoverResult {
  const q = query(region, category);
  const full = runPopAllQuery(popups, q, today);

  const skipSet = new Set(skipped);
  const left = runPopAllQuery(
    popups.filter((p) => !skipSet.has(Number(p.id))),
    q,
    today,
  );

  const emptiness: DiscoverEmptiness =
    left.total > 0 ? 'none' : full.total > 0 ? 'all-skipped' : 'no-stock';

  return {
    items: left.items.slice(0, DISCOVER_CARD_LIMIT),
    total: full.total,
    emptiness,
    relaxSuggestions: left.relaxSuggestions,
  };
}
