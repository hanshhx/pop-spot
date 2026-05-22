import type { MetadataRoute } from "next";

/**
 * 검색엔진 크롤러 정책 (Naver / Google / Bing 등).
 *
 * <p>v2.15 — 운영 도메인을 네이버 / 구글 사이트맵 등록하기 위해 신설.
 *
 * <ul>
 *   <li>공개 경로 (지도 / 약관 / 개인정보 / about / intro / 팝업 상세) 는 색인 허용
 *   <li>비공개 경로 (admin / login / signup / oauth / feedback / find-account / api) 는 차단
 *   <li>자동수집 팝업 상세는 약관 §10-2 의 "재배포 X" 정책 일관성을 위해 sitemap 에 미포함
 *       (단 robots 단에서는 막지 않아 자연스러운 백링크는 유지). 페이지 자체는 클라이언트
 *       렌더링이라 크롤러가 본문을 가져가지 않는다
 *   <li>{@code sitemap.xml} 위치를 함께 알려주어 인덱싱 효율 ↑
 * </ul>
 */
const SITE_URL = "https://popspot.co.kr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/login",
          "/login/",
          "/signup",
          "/signup/",
          "/find-account",
          "/find-account/",
          "/oauth/",
          "/feedback",
          "/feedback/",
          "/planning",
          "/planning/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
