import type { Metadata } from 'next';

/**
 * v2.15 — 어드민 콘솔은 검색엔진 색인 차단. 운영자 전용이고 PII / 운영 정보가 노출되면
 * 안 됨. {@code public/robots.txt} 에서도 disallow 되어 있지만, 안전을 위해 페이지 메타에서도 명시.
 * (이 프로젝트에 {@code app/robots.ts} 는 없다 — 예전 주석이 그렇게 적혀 있어 바로잡는다.)
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
