import type { Metadata } from 'next';

/**
 * v2.15 — 로그인 페이지는 검색엔진 색인 차단. 동일 페이지가 중복 노출되거나 로그인 URL 이
 * 직접 검색에 잡힐 필요가 없음.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
