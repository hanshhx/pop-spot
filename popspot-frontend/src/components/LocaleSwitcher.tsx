'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Globe } from 'lucide-react';
import { LOCALES, type Locale, useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

/**
 * 언어 전환 — 한국어 · English · 日本語.
 *
 * <p><b>버튼이 아니라 링크다.</b> 화면 언어만 바꾸면 주소가 그대로라 공유한 링크가 상대에게는 다른
 * 언어로 열리고, 검색엔진도 영어·일본어 판이 있다는 것을 알 수 없다. 언어마다 주소가 따로 있어야
 * 한다({@code /}, {@code /en}, {@code /ja}).
 *
 * <p>드롭다운이 아니라 셋을 한 줄로 펼친다 — 항목이 셋뿐이라 접어 둘 이유가 없고, 외국인 방문자는
 * "메뉴를 열어 언어를 찾는" 단계에서 이탈한다. 각 언어를 <b>그 언어로</b> 적는 것도 같은 이유다.
 */
export default function LocaleSwitcher({
  locale,
  className = '',
}: {
  locale: Locale;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setLocale } = useLocale();
  const query = searchParams.toString();
  const currentHref = `${pathname || '/'}${query ? `?${query}` : ''}`;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-pill border border-gray-200 bg-white/80 px-1.5 py-1 backdrop-blur dark:border-white/10 dark:bg-black/40 ${className}`}
      role="group"
      aria-label="Language"
    >
      <Globe size={14} className="mx-1 shrink-0 text-muted-foreground" aria-hidden />
      {LOCALES.map(({ code, label }) => {
        const active = code === locale;
        return (
          <Link
            key={code}
            href={localizedPath(currentHref, code)}
            hrefLang={code}
            onClick={() => setLocale(code)}
            aria-current={active ? 'true' : undefined}
            className={`rounded-pill px-2.5 py-1 text-[11px] font-bold transition ${
              active
                ? 'bg-lime-300 text-ink-900'
                : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
