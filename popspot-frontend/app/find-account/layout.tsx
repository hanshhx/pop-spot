import type { Metadata } from "next";

/** v2.15 — 계정 찾기 페이지는 검색엔진 색인 차단. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FindAccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
