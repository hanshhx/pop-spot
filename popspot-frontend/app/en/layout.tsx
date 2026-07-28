import { LocaleProvider } from '@/lib/i18n';

/**
 * {@code /en} 아래는 처음부터 영어로 그린다.
 *
 * <p>루트 레이아웃에도 {@code LocaleProvider} 가 있지만, 컨텍스트는 <b>가장 가까운 것이 이긴다.</b>
 * 여기서 한 겹 더 감싸면 이 주소의 화면만 영어로 고정된다.
 *
 * <p>브라우저에서 뒤늦게 바꾸는 방식이면 크롤러가 받는 HTML 은 여전히 한국어라, 주소를 나눈 의미가
 * 없다. 서버가 처음부터 영어로 그려야 검색엔진이 영어 페이지로 인식한다.
 */
export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <LocaleProvider initialLocale="en">{children}</LocaleProvider>;
}
