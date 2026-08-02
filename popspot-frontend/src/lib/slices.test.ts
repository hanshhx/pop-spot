import { describe, expect, it } from 'vitest';

import { BRANDS, CATEGORIES, brandBySlug, getPeriods, periodBySlug } from '@/lib/popupSlices';
import { REGIONS, regionBySlug } from '@/lib/regions';

/**
 * 슬러그 체계 전체의 불변식.
 *
 * 슬러그는 **URL 이다.** 겹치거나 사라지면 이미 색인된 주소가 다른 페이지를 가리키거나 404 가 된다.
 * `dynamicParams = false` 라서 목록에서 빠진 슬러그는 즉시 404 다 — 되돌릴 여지가 없다.
 *
 * 종류가 넷(지역·시점·카테고리·브랜드)인데 **주소 공간은 하나**라, 서로 다른 파일에서 각자 늘리다가
 * 언젠가 부딪힌다. 부딪히는 순간 `resolveSlice` 의 검사 순서에 따라 조용히 한쪽이 이긴다.
 */

const ALL_SLUGS = [
  ...REGIONS.map((r) => r.slug),
  ...getPeriods().map((p) => p.slug),
  ...CATEGORIES.map((c) => c.slug),
  ...BRANDS.map((b) => b.slug),
];

describe('슬러그 주소 공간', () => {
  it('네 종류를 통틀어 겹치는 슬러그가 없다', () => {
    const seen = new Map<string, number>();
    for (const s of ALL_SLUGS) seen.set(s, (seen.get(s) ?? 0) + 1);

    expect([...seen.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  it('슬러그는 소문자·숫자·하이픈만 쓴다 — URL 이 인코딩되면 안 된다', () => {
    for (const s of ALL_SLUGS) {
      expect(s, s).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('지역·카테고리는 code 와 slug 가 같다 — 분류 결과로 URL 을 찾기 때문', () => {
    for (const r of REGIONS) expect(r.slug).toBe(r.code);
    for (const c of CATEGORIES) expect(c.slug).toBe(c.code);
  });
});

describe('조합 슬러그와의 충돌', () => {
  /**
   * `/popups/yongsan-ipark` 는 브랜드다. 그런데 `yongsan`(지역) + `-` 로도 읽힌다.
   * 실존하는 충돌이라 해석 순서가 바뀌면 조용히 다른 페이지가 뜬다.
   */
  it('yongsan-ipark 은 지역 조합이 아니라 브랜드로 해석된다', () => {
    expect(brandBySlug('yongsan-ipark')).toBeDefined();
    // 조합으로 읽으면 뒤쪽이 시점·카테고리여야 하는데 'ipark' 은 둘 다 아니다.
    expect(periodBySlug('ipark')).toBeUndefined();
    expect(CATEGORIES.find((c) => c.slug === 'ipark')).toBeUndefined();
  });

  it('브랜드 슬러그가 지역 슬러그로 시작하면 뒷부분이 시점·카테고리가 아니어야 한다', () => {
    const periodSlugs = new Set(getPeriods().map((p) => p.slug));
    const categorySlugs = new Set(CATEGORIES.map((c) => c.slug));

    for (const b of BRANDS) {
      for (const r of REGIONS) {
        if (!b.slug.startsWith(`${r.slug}-`)) continue;
        const rest = b.slug.slice(r.slug.length + 1);
        expect(periodSlugs.has(rest), `${b.slug} 가 ${r.slug} × 시점과 충돌`).toBe(false);
        expect(categorySlugs.has(rest), `${b.slug} 가 ${r.slug} × 카테고리와 충돌`).toBe(false);
      }
    }
  });
});

describe('정의의 완결성', () => {
  it('브랜드는 세 언어 표시명과 키워드를 모두 갖는다', () => {
    for (const b of BRANDS) {
      expect(b.label, b.slug).toBeTruthy();
      expect(b.labelEn, b.slug).toBeTruthy();
      expect(b.labelJa, b.slug).toBeTruthy();
      expect(b.keywords.length, b.slug).toBeGreaterThan(0);
    }
  });

  it('브랜드 키워드에 너무 짧은 것이 없다 — 두 글자면 엉뚱한 팝업을 끌어온다', () => {
    for (const b of BRANDS) {
      for (const kw of b.keywords) {
        expect(kw.trim().length, `${b.slug}: '${kw}'`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('slug 로 정의를 되찾을 수 있다', () => {
    for (const r of REGIONS) expect(regionBySlug(r.slug)?.code).toBe(r.code);
    for (const b of BRANDS) expect(brandBySlug(b.slug)?.slug).toBe(b.slug);
    for (const p of getPeriods()) expect(periodBySlug(p.slug)?.code).toBe(p.code);
  });
});
