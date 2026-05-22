import type { Metadata } from "next";

/**
 * v2.15 — OAuth 콜백 페이지는 검색엔진 색인 차단. 토큰 처리 / 리다이렉트 전용이고 사용자가
 * 검색으로 진입할 일 없음.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OAuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
