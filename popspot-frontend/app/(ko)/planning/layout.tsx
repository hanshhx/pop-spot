import type { Metadata } from 'next';

/**
 * v2.15 — 작전 회의실 (planning) 페이지는 검색엔진 색인 차단. 회원 전용 협업 공간이고
 * 방 ID 가 URL 에 포함되므로 검색 노출 시 사생활 침해 우려.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
