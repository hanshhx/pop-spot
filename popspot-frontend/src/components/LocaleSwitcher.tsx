'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { LOCALES, type Locale, useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

/** Keeps language-specific URLs shareable while using a compact menu on mobile. */
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
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 px-3 text-[11px] font-black uppercase text-foreground shadow-sm backdrop-blur transition hover:border-lime-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 md:hidden dark:border-white/10 dark:bg-black/55"
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
              className="fixed z-[10010] min-w-40 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 text-gray-900 shadow-xl md:hidden dark:border-white/10 dark:bg-[#171717] dark:text-white"
            >
              {localeLinks(true)}
            </div>,
            document.body,
          )
        : null}

      <div
        className="hidden items-center gap-1 rounded-pill border border-gray-200 bg-white/80 px-1.5 py-1 backdrop-blur md:inline-flex dark:border-white/10 dark:bg-black/40"
        role="group"
        aria-label="Language"
      >
        <Globe size={14} className="mx-1 shrink-0 text-muted-foreground" aria-hidden />
        {localeLinks(false)}
      </div>
    </div>
  );
}
