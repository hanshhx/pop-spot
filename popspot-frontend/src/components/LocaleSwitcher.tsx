'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { LOCALES, type Locale, useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { LOCALE_SWITCHING_CLASS, runTransientClass } from '@/lib/transientClass';

/** Keeps language-specific URLs shareable while using a compact menu on mobile. */
export default function LocaleSwitcher({
  locale,
  className = '',
  compact = false,
}: {
  locale: Locale;
  className?: string;
  /**
   * 넓은 화면에서도 <b>지구본 메뉴</b>로 둔다.
   *
   * <p>기본값은 좁은 화면만 메뉴이고 넓으면 칩 세 개를 늘어놓는다. 그 칩 줄은 200px 남짓이라,
   * 헤더처럼 빽빽한 한 줄에 들어가면 옆의 네비 글자가 세로로 깨진다(실제로 그랬다). 헤더는
   * 이 값을 켠다.
   */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [mobileMenuPosition, setMobileMenuPosition] = useState({ top: 0, right: 0 });
  const query = searchParams.toString();
  const currentHref = `${pathname || '/'}${query ? `?${query}` : ''}`;

  useEffect(() => {
    if (!open) return;

    const updateMobileMenuPosition = () => {
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      if (!buttonRect) return;
      setMobileMenuPosition({
        top: buttonRect.bottom + 4,
        right: Math.max(12, window.innerWidth - buttonRect.right),
      });
    };

    updateMobileMenuPosition();

    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!switcherRef.current?.contains(target) && !mobileMenuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener('pointerdown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updateMobileMenuPosition);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updateMobileMenuPosition);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  const localeLinks = (mobile: boolean) =>
    LOCALES.map(({ code, label }) => {
      const active = code === locale;
      return (
        <Link
          key={code}
          role={mobile ? 'menuitem' : undefined}
          href={localizedPath(currentHref, code)}
          hrefLang={code}
          onClick={() => {
            /*
             * 언어를 바꾸면 화면의 모든 글이 한 프레임에 갈린다. 길이도 함께 달라져서(한국어 →
             * 영어는 대개 길어진다) 글자만 바뀌는 게 아니라 줄바꿈과 높이까지 튄다. 짧게 흐리게
             * 했다가 되돌려, 그 교체를 가려 준다.
             *
             * 이 처리를 LocaleProvider 가 아니라 버튼에 두는 이유는 Provider 가 겹치기 때문이다 —
             * /ja 아래에는 루트 것 안에 하나가 더 있어서(i18n.tsx 의 lang 주석), 값 변화에 걸면
             * 한 번 누른 것이 두 번 발화한다. 바꾸겠다고 누른 이 자리에는 그런 겹침이 없다.
             *
             * 이미 그 언어면 아무 일도 안 일어나므로 흐리게 할 이유도 없다.
             */
            if (!active) {
              runTransientClass(
                document.documentElement,
                LOCALE_SWITCHING_CLASS,
                '--locale-switch-ms',
              );
            }
            setLocale(code);
            setOpen(false);
          }}
          aria-current={active ? 'true' : undefined}
          className={
            mobile
              ? `flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-bold transition ${
                  active ? 'bg-lime-300 text-ink-900' : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`
              : `inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-3 py-2 text-[11px] font-bold transition ${
                  active
                    ? 'bg-lime-300 text-ink-900'
                    : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10'
                }`
          }
        >
          {label}
          {mobile && active ? <Check size={16} aria-hidden /> : null}
        </Link>
      );
    });

  return (
    <div ref={switcherRef} className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Language"
        className={
          'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 px-3 text-[11px] font-black uppercase text-foreground shadow-sm backdrop-blur transition hover:border-lime-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 dark:border-white/10 dark:bg-black/55' +
          (compact ? '' : ' md:hidden')
        }
      >
        <Globe size={16} aria-hidden />
        {locale}
        <ChevronDown
          size={14}
          className={open ? 'rotate-180 transition' : 'transition'}
          aria-hidden
        />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={mobileMenuRef}
              role="menu"
              style={mobileMenuPosition}
              className={
                'fixed z-[10010] min-w-40 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 text-gray-900 shadow-xl dark:border-white/10 dark:bg-[#171717] dark:text-white' +
                (compact ? '' : ' md:hidden')
              }
            >
              {localeLinks(true)}
            </div>,
            document.body,
          )
        : null}

      {!compact && (
        <div
          className="hidden items-center gap-1 rounded-pill border border-gray-200 bg-white/80 px-1.5 py-1 backdrop-blur md:inline-flex dark:border-white/10 dark:bg-black/40"
          role="group"
          aria-label="Language"
        >
          <Globe size={14} className="mx-1 shrink-0 text-muted-foreground" aria-hidden />
          {localeLinks(false)}
        </div>
      )}
    </div>
  );
}
