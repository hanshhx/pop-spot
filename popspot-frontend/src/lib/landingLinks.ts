import { localizedLabel } from '@/lib/localeLabel';
import { PRIORITY_LANDING_LINKS } from '@/lib/priorityLandingLinks';
import { BRANDS, CATEGORIES, getPeriods } from '@/lib/popupSlices';
import { REGIONS } from '@/lib/regions';
import type { Locale } from '@/lib/i18n';

/**
 * 사이트 안에서 <b>랜딩으로 가는 길</b>의 목록.
 *
 * <p><b>왜 한 곳에 두나.</b> 랜딩끼리는 서로 107~108개씩 이어져 있는데 홈은 27개뿐이었다(2026-09-03
 * 실측). 홈이 사이트에서 가장 힘이 센 페이지인데 거기서 랜딩으로 보내는 길이 가장 적었다.
 *
 * <p>홈에도 같은 목록을 깔되, 목록을 <b>두 벌로 두면 반드시 갈라진다.</b> 새 지역이나 브랜드를
 * 더했을 때 한쪽에만 반영되면, 그 랜딩은 사이트 안에서 들어가는 길이 반쪽이 된다 — 화면에는 아무
 * 표시도 안 난다. 그래서 어디로 갈 수 있는지는 여기서만 정하고, 어떻게 그릴지는 각 화면이 정한다.
 */

export interface LandingLink {
  slug: string;
  label: string;
  kind: string;
  /**
   * 급상승 검색어로 연 랜딩인가.
   *
   * <p>{@code kind} 로는 못 가른다 — 우선 링크의 kind 는 region·brand 처럼 <b>일반 종류와 같은
   * 값</b>이다. 화면이 이 표시를 보고 앞에 크게 둔다.
   */
  priority: boolean;
}

/**
 * 랜딩 링크 전체.
 *
 * @param exceptSlug 지금 보고 있는 랜딩. 자기 자신으로 가는 링크는 뜻이 없다
 */
export function landingLinks(locale: Locale, exceptSlug?: string): LandingLink[] {
  const L = (d: { label: string; labelEn: string; labelJa: string }) => localizedLabel(d, locale);

  return [
    /* 급상승 검색어로 연 것이 먼저다 — 지금 사람들이 실제로 찾는 말이다. */
    ...PRIORITY_LANDING_LINKS.map((item) => ({
      slug: item.slug,
      label: L(item),
      kind: item.kind as string,
      priority: true,
    })),
    ...BRANDS.map((b) => ({ slug: b.slug, label: L(b), kind: 'brand', priority: false })),
    ...REGIONS.map((r) => ({ slug: r.slug, label: L(r), kind: 'region', priority: false })),
    ...getPeriods().map((p) => ({ slug: p.slug, label: L(p), kind: 'period', priority: false })),
    ...CATEGORIES.map((c) => ({ slug: c.slug, label: L(c), kind: 'category', priority: false })),
  ]
    .filter((s) => s.slug !== exceptSlug)
    .filter((item, i, all) => all.findIndex((c) => c.slug === item.slug) === i);
}
