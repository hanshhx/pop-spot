import { SiteDocument, siteMetadata, siteViewport } from '@/app/SiteDocument';

/**
 * 한국어 트리의 <b>루트</b> 레이아웃. 접두어 없는 주소 전부({@code /}, {@code /about}, …)가 여기 걸린다.
 *
 * <p>{@code (ko)} 는 라우트 그룹이라 <b>URL 에 나타나지 않는다.</b> 디렉터리만 한 겹 생겼을 뿐
 * 주소는 예전과 한 글자도 같다.
 *
 * <p>왜 루트를 셋으로 쪼갰는지는 {@link SiteDocument} 주석에 있다.
 */
export const metadata = siteMetadata();
export const viewport = siteViewport;

export default function KoRootLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument locale="ko">{children}</SiteDocument>;
}
