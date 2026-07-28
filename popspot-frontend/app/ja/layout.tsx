import { LocaleProvider } from '@/lib/i18n';

/**
 * {@code /ja} 아래는 처음부터 일본어로 그린다. 경위는 {@code app/en/layout.tsx} 와 같다 —
 * 컨텍스트는 가장 가까운 것이 이기므로 이 주소의 화면만 일본어로 고정된다.
 */
export default function JaLayout({ children }: { children: React.ReactNode }) {
  return <LocaleProvider initialLocale="ja">{children}</LocaleProvider>;
}
