import type { MetadataRoute } from 'next';

import { REGIONS } from '@/lib/regions';
import { PERIODS, CATEGORIES, BRANDS } from '@/lib/popupSlices';

/**
 * Sitemap.xml 자동 생성 (Next.js {@code MetadataRoute.Sitemap}).
 *
 * <p>v2.15 — 네이버 / 구글 서치 콘솔에 등록할 sitemap. 정책상 안전한 정적 페이지만 포함.
 *
 * <p>v2.21-S3 — Long-tail SEO 랜딩 페이지 ({@code /popups/[slug]}) 자동 등록.
 * 지역 / 시점 / 카테고리 슬라이스 페이지가 모두 sitemap 에 포함되어 Naver / Google
 * 이 long-tail 키워드 ("성수동 팝업 추천" 등) 로 잡을 수 있게 한다.
 *
 * <ul>
 *   <li>팝업 상세 ({@code /popup/[id]}) 는 sitemap 에 넣지 않는다 — app/popup/[id]/layout.tsx 에서
 *       noindex 이기 때문이다(회원 채팅이 같은 URL 에 살아 약관 §14 를 지키려면 색인할 수 없다).
 *       noindex 페이지를 sitemap 에 올리면 크롤러에게 "와서 보라"와 "색인하지 마라"를 동시에
 *       말하는 셈이라 크롤 예산만 쓴다. 예전 주석은 이 배제를 §10-2 "검색 결과 재현" 조항으로
 *       설명했는데, 개별 팝업 URL 목록은 검색 결과 페이지의 재현이 아니라 근거가 맞지 않았다.
 *   <li>슬라이스 랜딩 페이지는 운영자가 직접 큐레이션한 분류 (지역 / 시점 / 카테고리) 라
 *       약관 §10-2 의 "검색 결과 재현" 에 해당하지 않음 (집계 / 분류만).
 *   <li>사용자 게시판 (동행 / 의견) 도 PII 보호를 위해 미포함.
 * </ul>
 */
const SITE_URL = 'https://popspot.co.kr';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // v2.21-S3 — Long-tail 슬라이스 랜딩 페이지
  const sliceLandings: MetadataRoute.Sitemap = [
    ...REGIONS.map((r) => ({
      url: `${SITE_URL}/popups/${r.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...PERIODS.map((p) => ({
      url: `${SITE_URL}/popups/${p.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}/popups/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    // 브랜드·IP·장소 랜딩 ("스텔라이브 팝업" 등). 매칭 0곳이면 페이지 단에서 noindex.
    ...BRANDS.map((b) => ({
      url: `${SITE_URL}/popups/${b.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    // v2.29 — 지역×카테고리 조합 롱테일 랜딩 ("성수 패션" 등, 큐레이션 집계라 §10-2 준수).
    ...REGIONS.flatMap((r) =>
      CATEGORIES.map((c) => ({
        url: `${SITE_URL}/popups/${r.slug}-${c.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ),
  ];

  return [...staticPages, ...sliceLandings];
}
