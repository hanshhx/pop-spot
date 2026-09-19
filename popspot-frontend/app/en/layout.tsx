import { SiteDocument, siteMetadata, siteViewport } from '@/app/SiteDocument';

/**
 * {@code /en} 트리의 <b>루트</b> 레이아웃.
 *
 * <p>예전엔 {@code LocaleProvider} 만 한 겹 감싸는 중첩 레이아웃이었고 {@code <html lang>} 은
 * 위쪽 루트가 요청 헤더({@code x-popspot-locale})를 읽어 정했다. 지금은 <b>이 파일이 루트</b>라
 * 로케일이 빌드 시점 리터럴이다 — 주소가 {@code /en} 으로 시작한다는 사실을 컴파일 타임에 이미
 * 아는데 런타임에 알아낼 이유가 없었다.
 *
 * <p>그래서 "헤더가 안 붙으면 영어 페이지가 {@code lang="ko"} 로 <b>조용히</b> 나가는" 실패 모드가
 * 사라진다. 옛 방식은 그 경우 삼항이 기본값으로 떨어질 뿐 아무 증상이 없었다.
 *
 * <p>{@code LocaleProvider} 는 {@link SiteDocument} 안에 있으므로 여기서 또 감싸지 않는다.
 */
export const metadata = siteMetadata();
export const viewport = siteViewport;

export default function EnRootLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument locale="en">{children}</SiteDocument>;
}
