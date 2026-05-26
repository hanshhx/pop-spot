import type { Metadata } from "next";

/**
 * v2.17 — /privacy 페이지별 메타.
 */
export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "POP-SPOT 개인정보 처리방침 — 수집 항목 / 보유 기간 / 위탁 / 권리 행사 안내",
  alternates: { canonical: "https://popspot.co.kr/privacy" },
  openGraph: {
    title: "개인정보 처리방침 · POP-SPOT",
    description: "POP-SPOT 개인정보 처리방침 전문",
    url: "https://popspot.co.kr/privacy",
    type: "article",
    locale: "ko_KR",
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
