import { SiteDocument, siteMetadata, siteViewport } from '@/app/SiteDocument';

/**
 * {@code /ja} 트리의 <b>루트</b> 레이아웃. 경위는 {@code app/en/layout.tsx} 와 같다 —
 * 로케일이 빌드 시점 리터럴이라 요청 헤더가 필요 없다.
 */
export const metadata = siteMetadata();
export const viewport = siteViewport;

export default function JaRootLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument locale="ja">{children}</SiteDocument>;
}
