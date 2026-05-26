import type { Metadata } from "next";

/**
 * v2.17 — /about 페이지별 메타. 검색 노출 시 풍부도 향상.
 */
export const metadata: Metadata = {
  title: "서비스 소개",
  description: "POP-SPOT 의 보안 안전장치 7가지와 자동수집 운영 정책을 한눈에 안내합니다.",
  alternates: { canonical: "https://popspot.co.kr/about" },
  openGraph: {
    title: "서비스 소개 · POP-SPOT",
    description: "POP-SPOT 의 보안 안전장치 7가지와 자동수집 운영 정책 안내",
    url: "https://popspot.co.kr/about",
    type: "website",
    locale: "ko_KR",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
