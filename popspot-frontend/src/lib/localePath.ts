import type { Locale } from '@/lib/i18n';

const LOCALE_PREFIX = /^\/(en|ja)(?=\/|$)/;

/**
 * 현재 화면과 같은 기능을 다른 언어 주소로 연결한다.
 *
 * 외부 주소·앵커·API·관리자 주소는 건드리지 않는다. 나머지 공개 화면은 한국어가 기본 주소를 쓰고,
 * 영어와 일본어는 각각 /en, /ja 아래의 같은 경로를 쓴다.
 */
export function localizedPath(href: string, locale: Locale): string {
  if (
    !href.startsWith('/') ||
    href.startsWith('//') ||
    href.startsWith('/api/') ||
    href === '/api' ||
    href.startsWith('/admin/') ||
    href === '/admin'
  ) {
    return href;
  }

  const withoutLocale = href.replace(LOCALE_PREFIX, '') || '/';
  if (locale === 'ko') return withoutLocale;
  return withoutLocale === '/' ? `/${locale}` : `/${locale}${withoutLocale}`;
}

/** 주소의 첫 구간이 언어 코드면 해당 언어를, 아니면 한국어를 돌려준다. */
export function localeFromPath(pathname: string | null | undefined): Locale {
  const match = pathname?.match(LOCALE_PREFIX);
  return match?.[1] === 'en' || match?.[1] === 'ja' ? match[1] : 'ko';
}
