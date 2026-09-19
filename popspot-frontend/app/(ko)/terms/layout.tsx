import type { Metadata } from 'next';

/**
 * v2.17 — /terms 페이지별 메타. 약관 페이지의 검색 노출 풍부도.
 */
export const metadata: Metadata = {
  title: '이용약관',
  description:
    'POP-SPOT 이용약관 — 자동수집 / 외부 검색 API 사용 / 권리자 신고 / 검색엔진 노출 정책',
  alternates: { canonical: 'https://popspot.co.kr/terms' },
  openGraph: {
    title: '이용약관 · POP-SPOT',
    description: 'POP-SPOT 이용약관 전문',
    url: 'https://popspot.co.kr/terms',
    type: 'article',
    locale: 'ko_KR',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
