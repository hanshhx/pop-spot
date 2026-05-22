import type { MetadataRoute } from "next";

/**
 * Sitemap.xml 자동 생성 (Next.js {@code MetadataRoute.Sitemap}).
 *
 * <p>v2.15 — 네이버 / 구글 서치 콘솔에 등록할 sitemap. 정책상 안전한 정적 페이지만 포함한다.
 *
 * <ul>
 *   <li>자동수집 팝업 상세 (sourceType=CRAWLED) 는 약관 §10-2 의 "검색 결과 페이지 자체를
 *       본 서비스에서 재현하지 않습니다" 조항과 일관성 유지를 위해 sitemap 에 포함하지 않음.
 *       페이지 자체는 클라이언트 렌더링이라 어차피 크롤러가 본문을 가져가지 않지만, sitemap
 *       에 명시적으로 등록해 가공된 검색 결과를 다시 검색엔진에 노출시키는 형태는 의도적으로
 *       피한다.
 *   <li>사용자 게시판 (동행 / 의견) 도 PII 보호를 위해 미포함.
 *   <li>운영자가 직접 작성한 정책 / 안내 페이지만 포함 (지도 메인 / 서비스 소개 / 약관 /
 *       개인정보 / 인트로).
 * </ul>
 */
const SITE_URL = "https://popspot.co.kr";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/intro`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
