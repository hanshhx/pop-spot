import type { Metadata } from "next";

/** v2.15 — 회원가입 페이지는 검색엔진 색인 차단. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
