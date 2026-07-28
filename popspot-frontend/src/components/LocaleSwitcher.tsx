'use client';

import { Globe } from 'lucide-react';
import { LOCALES, type Locale } from '@/lib/i18n';

/**
 * 언어 전환 — 한국어 · English · 日本語.
 *
 * <p>드롭다운이 아니라 <b>세 개를 한 줄로 펼친다.</b> 항목이 셋뿐이라 접어 둘 이유가 없고, 외국인
 * 방문자는 "메뉴를 열어 언어를 찾는" 단계에서 이탈한다. 각 언어를 <b>그 언어로</b> 적는 것도 같은
 * 이유다 — 한국어 화면에서 "Japanese" 를 찾는 것보다 "日本語" 를 찾는 편이 빠르다.
 */
export default function LocaleSwitcher({
  locale,
  onChange,
  className = '',
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
  className?: string;
}) {
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
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            aria-pressed={active}
            className={`rounded-pill px-2.5 py-1 text-[11px] font-bold transition ${
              active
                ? 'bg-lime-300 text-ink-900'
                : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
