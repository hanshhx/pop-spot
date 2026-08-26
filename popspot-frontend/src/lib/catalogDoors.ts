import type { PopupStore } from '@/types/popup';

import { REGIONS, classifyRegion } from './regions';
import {
  CATEGORIES,
  BRANDS,
  classifyCategory,
  matchesPeriod,
  type PeriodCode,
} from './popupSlices';

/**
 * 벤토 4칸 = 850곳으로 들어가는 문 하나.
 *
 * <p>팝업 카드 대신 이 넷을 그린다. 각 문은 이미 만들어져 있는 {@code /popups/[slug]} 랜딩으로
 * 보낸다 — 새 라우트를 만들지 않는다.
 */
export interface CatalogDoor {
  /**
   * i18n 키가 아니라 <b>어느 축의 무엇인지</b>를 담은 값이다({@code "축:슬러그"}, 예: {@code
   * "region:gangnam"}). 라벨은 부르는 쪽이 REGIONS/CATEGORIES/BRANDS/getPeriods 에서 같은
   * slug 로 다시 찾아 화면 언어로 만든다 — 이 파일은 사전을 모른다.
   */
  key: string;
  /** 이 문 뒤에 몇 곳 있는지. 0이면 아예 배열에 없다 — 눌렀더니 빈 목록인 문은 고장이다. */
  count: number;
  /** {@code /popups/[slug]} 로 가는 로케일 무관 경로. 부르는 쪽이 localizedPath 로 감싼다. */
  href: string;
}

/**
 * 문 중 하나가 서는 시점 축. {@code getPeriods()} 의 다섯 슬라이스 중 하나를 고정으로 쓴다.
 *
 * <p>소유자가 제안한 "이번 주 새로 시작"·"곧 마감"은 이 코드베이스에 <b>랜딩이 없다</b> —
 * {@code periodBySlug} 가 아는 시점은 getPeriods 의 다섯 개(오늘·내일·이번 주·이번 주말·이번 달)
 * 뿐이고, "새로 시작"·"마감임박"은 그 안에서 <b>정렬 기준</b>일 뿐 독립된 슬러그가 아니다(랜딩
 * 페이지의 마감임박순 정렬·D-day 배지가 그 예). 새 슬러그를 만들면 "새로 만들 것이 없다" 는
 * 이 태스크의 전제를 깨고, 랜딩이 없는 문은 눌러도 갈 곳이 없다. 그래서 이미 있는 다섯 시점 중
 * "이번 주" 를 쓴다 — 지역·카테고리·브랜드와 성격이 다른 네 번째 축이면서 실제로 존재하는 문이다.
 */
const DOOR_PERIOD: PeriodCode = 'this-week';

/** 후보 중 개수가 가장 많은 슬러그 하나. 동점이면 배열에 먼저 나온 쪽(더 상위 노출) 이 이긴다. */
function biggestSlug(
  slugs: string[],
  countOf: (slug: string) => number,
): { slug: string; count: number } {
  let best = { slug: slugs[0] ?? '', count: -1 };
  for (const slug of slugs) {
    const count = countOf(slug);
    if (count > best.count) best = { slug, count };
  }
  return best;
}

function regionDoor(pool: PopupStore[]): CatalogDoor {
  const { slug, count } = biggestSlug(
    REGIONS.map((r) => r.slug),
    (slug) => pool.filter((p) => classifyRegion(p.location) === slug).length,
  );
  return { key: `region:${slug}`, count, href: `/popups/${slug}` };
}

function categoryDoor(pool: PopupStore[]): CatalogDoor {
  const { slug, count } = biggestSlug(
    CATEGORIES.map((c) => c.slug),
    (slug) => pool.filter((p) => classifyCategory(p.category) === slug).length,
  );
  return { key: `category:${slug}`, count, href: `/popups/${slug}` };
}

function periodDoor(pool: PopupStore[], today: Date): CatalogDoor {
  const count = pool.filter((p) =>
    matchesPeriod(p.startDate, p.endDate, DOOR_PERIOD, today),
  ).length;
  return { key: `period:${DOOR_PERIOD}`, count, href: `/popups/${DOOR_PERIOD}` };
}

function brandDoor(pool: PopupStore[]): CatalogDoor {
  const { slug, count } = biggestSlug(
    BRANDS.map((b) => b.slug),
    (slug) => {
      const keywords = (BRANDS.find((b) => b.slug === slug)?.keywords ?? []).map((k) =>
        k.toLowerCase(),
      );
      return pool.filter((p) => {
        const hay = `${p.name ?? ''} ${p.location ?? ''}`.toLowerCase();
        return keywords.some((k) => hay.includes(k));
      }).length;
    },
  );
  return { key: `brand:${slug}`, count, href: `/popups/${slug}` };
}

/**
 * 850곳으로 들어가는 문 최대 {@code limit} 개.
 *
 * <p>네 축(지역·카테고리·시점·브랜드)에서 각각 가장 큰 슬라이스 하나씩을 문으로 낸다. 넷이
 * 전부 같은 종류(예: 카테고리 넷)면 그것도 반복이라 — 축 자체를 서로 다르게 고정했다.
 *
 * <p>분류는 <b>랜딩 페이지({@code app/popups/[slug]/page.tsx})와 같은 함수</b>를 그대로 쓴다
 * (classifyRegion·classifyCategory·matchesPeriod, 브랜드는 같은 키워드 substring 매칭). 여기서
 * 다르게 분류하면 문에 적힌 개수와 그 문이 여는 페이지의 개수가 어긋난다.
 *
 * <p><b>개수가 0인 문은 만들지 않는다.</b> 눌렀더니 빈 목록인 문은 기능이 아니라 고장이다.
 */
export function catalogDoors(pool: PopupStore[], today: Date, limit: number): CatalogDoor[] {
  if (pool.length === 0) return [];

  const candidates = [
    regionDoor(pool),
    categoryDoor(pool),
    periodDoor(pool, today),
    brandDoor(pool),
  ];

  // 문 뒤가 빈 것은 여기서 걸러낸다 — 이 필터를 지우면 count:0 인 문이 그대로 나간다.
  return candidates.filter((d) => d.count > 0).slice(0, limit);
}
