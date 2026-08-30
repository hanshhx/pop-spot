import type { PopupStore } from '@/types/popup';
import { classifyCategory, parseDate, type CategoryCode } from './popupSlices';
import { classifyRegion, type RegionCode } from './regions';
import { popupBadge } from './popupBadges';

/**
 * 한 페이지에 담는 칸 수.
 *
 * <p>웹은 24다 — 4~5열 x 5~6줄로 스크롤 한 번에 끝나는 분량. 앱은 <b>2열</b>이라 같은 24를 쓰면
 * 12줄이 되고, 페이지 번호를 누를 때마다 열두 줄을 거슬러 올라가야 한다. 2열 x 4줄로 맞춘다.
 *
 * <p>이 상수만 다르고 아래 질의 로직은 웹과 한 글자도 다르지 않다. 정렬 순서·완화 제안·페이지
 * 당겨넣기가 두 곳에서 갈리면 "웹에선 보이는데 앱에선 안 보이는" 팝업이 생긴다.
 */
export const POP_ALL_PAGE_SIZE = 8;

export type PopAllSort = 'latest' | 'deadline' | 'popular';
export type PopAllBadgeFilter = 'closingSoon' | 'openingToday' | null;

export interface PopAllQuery {
  keyword: string;
  region: RegionCode | null;
  category: CategoryCode | null;
  badge: PopAllBadgeFilter;
  sort: PopAllSort;
  /** 1부터 센다. */
  page: number;
}

/** 결과가 0일 때 "이 조건 하나만 풀면 N곳" 을 담는다. */
export interface RelaxSuggestion {
  field: 'keyword' | 'region' | 'category' | 'badge';
  count: number;
}

export interface PopAllResult {
  items: PopupStore[];
  total: number;
  totalPages: number;
  /** 범위를 벗어난 요청을 당겨 넣은 뒤의 실제 페이지. */
  page: number;
  relaxSuggestions: RelaxSuggestion[];
}

export const EMPTY_POP_ALL_QUERY: PopAllQuery = {
  keyword: '',
  region: null,
  category: null,
  badge: null,
  sort: 'latest',
  page: 1,
};

/** 검색이 훑는 칸들. 3개 국어 이름과 장소까지 본다. */
function haystack(p: PopupStore): string {
  return [p.name, p.nameEn, p.nameJa, p.location, p.locationEn, p.locationJa, p.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matches(p: PopupStore, query: PopAllQuery, today: Date): boolean {
  const kw = query.keyword.trim().toLowerCase();
  if (kw && !haystack(p).includes(kw)) return false;
  if (query.region && classifyRegion(p.location) !== query.region) return false;
  if (query.category && classifyCategory(p.category) !== query.category) return false;
  if (query.badge) {
    const badge = popupBadge(p.startDate, p.endDate, today);
    if (badge?.kind !== query.badge) return false;
  }
  return true;
}

/** 날짜를 밀리초로. 읽을 수 없으면 부르는 쪽이 정한 극값으로 — 그 값이 정렬에서의 자리를 정한다. */
function time(value: string | null | undefined, fallback: number): number {
  const d = parseDate(value ?? null);
  return d ? d.getTime() : fallback;
}

/**
 * 정렬 세 축 — 레일(HomeClient)이 쓰는 것과 같은 비교자다.
 *
 * <p><b>마지막 항이 id 인 것이 핵심이다.</b> 두 가지를 동시에 해결한다.
 *
 * <p>첫째, 동점 안정화. 크롤로 들어온 팝업 다수가 viewCount=0 이고 날짜도 겹쳐 동점이 흔한데,
 * 안정화하지 않으면 페이지를 넘길 때마다 순서가 흔들려 같은 팝업을 두 번 보거나 아예 못 본다.
 *
 * <p>둘째, <b>NaN 방어</b>. 날짜가 없는 자리를 Infinity 로 대신하므로 둘 다 없으면
 * {@code Infinity - Infinity = NaN} 이 되고, 비교자가 NaN 을 돌려주면 정렬 결과는 엔진
 * 마음대로가 된다. NaN 은 falsy 라 {@code ||} 사슬이 다음 항으로 넘겨 주고, 결국 id 가 받는다.
 */
function sortItems(list: PopupStore[], sort: PopAllSort): PopupStore[] {
  const out = [...list];
  if (sort === 'deadline') {
    // 종료일 미상은 Infinity 로 맨 뒤 — 모르는 것을 가장 급한 것으로 올리지 않는다.
    out.sort(
      (a, b) =>
        time(a.endDate, Infinity) - time(b.endDate, Infinity) ||
        (b.viewCount || 0) - (a.viewCount || 0) ||
        b.id - a.id,
    );
  } else if (sort === 'latest') {
    // 시작일 미상은 -Infinity 로 맨 뒤(내림차순이므로).
    out.sort((a, b) => time(b.startDate, -Infinity) - time(a.startDate, -Infinity) || b.id - a.id);
  } else {
    out.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0) || b.id - a.id);
  }
  return out;
}

/** 조건 하나를 지운 질의. 완화 제안을 세기 위한 것. */
function without(query: PopAllQuery, field: RelaxSuggestion['field']): PopAllQuery {
  return field === 'keyword' ? { ...query, keyword: '' } : { ...query, [field]: null };
}

/**
 * 결과가 0일 때 <b>다음에 무엇을 누르면 되는지</b>를 계산한다.
 *
 * <p>빈 화면에 "결과가 없습니다" 만 띄우는 것은 막다른 길이다. 목록이 통째로 메모리에 있으니
 * 조건을 하나씩 풀어 본 결과를 <b>실제로 세어서</b> 알려줄 수 있다 — 추측이 아니라 사실이다.
 *
 * <p>풀어도 0인 조건은 제안하지 않는다. 눌렀는데 또 0이면 안내가 아니라 두 번째 막다른 길이다.
 */
function relaxSuggestions(
  popups: PopupStore[],
  query: PopAllQuery,
  today: Date,
): RelaxSuggestion[] {
  const active: RelaxSuggestion['field'][] = [];
  if (query.keyword.trim()) active.push('keyword');
  if (query.region) active.push('region');
  if (query.category) active.push('category');
  if (query.badge) active.push('badge');
  // 조건이 하나뿐이면 그걸 푸는 것은 "필터 없음" 이라, 제안이 아니라 초기화 버튼의 일이다.
  if (active.length < 2) return [];

  return active
    .map((field) => ({
      field,
      count: popups.filter((p) => matches(p, without(query, field), today)).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * POP-ALL 모달이 한 페이지에 그릴 것을 통째로 계산한다.
 *
 * <p>홈이 이미 전체 목록을 메모리에 들고 있어({@code /api/popups}) 서버를 다시 부르지 않는다.
 * 그래서 타이핑마다 즉시 결과가 나오고, 디바운스도 로딩 상태도 필요 없다.
 *
 * <p>페이지 번호는 <b>당겨서</b> 돌려준다. 3페이지를 보다가 필터를 걸어 결과가 한 페이지로
 * 줄면, 빈 화면 대신 볼 것이 있는 마지막 페이지를 보여준다.
 */
export function runPopAllQuery(
  popups: PopupStore[],
  query: PopAllQuery,
  today: Date,
): PopAllResult {
  const filtered = popups.filter((p) => matches(p, query, today));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / POP_ALL_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(query.page) || 1), totalPages);
  const start = (page - 1) * POP_ALL_PAGE_SIZE;

  return {
    items: sortItems(filtered, query.sort).slice(start, start + POP_ALL_PAGE_SIZE),
    total,
    totalPages,
    page,
    relaxSuggestions: total === 0 ? relaxSuggestions(popups, query, today) : [],
  };
}
