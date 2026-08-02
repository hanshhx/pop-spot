'use client';

import Link from 'next/link';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';
import { SectionLogo } from '@/components/layout/BrandLogos';
import { localizedPath } from '@/lib/localePath';

/**
 * X (구 Twitter) 브랜드 로고 — lucide-react 가 리브랜딩된 X 로고를 제공하지 않아 inline SVG 로 처리.
 * viewBox 24x24, 단색 currentColor 로 부모 className 의 색상을 상속받는다.
 */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * 사이트 공통 푸터.
 *
 * <p>V4 자동수집 운영 시 가시성 필수 — 사용자가 약관 / 신고 절차에 쉽게 접근할 수 있어야 한다.
 * 더미 링크 (#) 는 두지 않고, 외부 메일 또는 내부 라우트로만 연결한다.
 */

const CONTACT_EMAIL = 'reo4321@naver.com';

const PLATFORM_LINKS: ReadonlyArray<{ labelKey: MessageKey; href: string }> = [
  { labelKey: 'footer.mapView', href: '/' },
  { labelKey: 'footer.calendar', href: '/' },
  { labelKey: 'footer.congestion', href: '/' },
  { labelKey: 'footer.magazine', href: '/' },
  { labelKey: 'footer.about', href: '/about' },
  { labelKey: 'feedback.send', href: '/feedback' },
  { labelKey: 'footer.terms', href: '/terms' },
  { labelKey: 'footer.privacy', href: '/privacy' },
];

const PARTNER_LINKS: ReadonlyArray<{ labelKey: MessageKey; href: string }> = [
  {
    labelKey: 'footer.partnerReg',
    href: `mailto:${CONTACT_EMAIL}`,
  },
  { labelKey: 'footer.business', href: `mailto:${CONTACT_EMAIL}` },
  { labelKey: 'footer.ads', href: `mailto:${CONTACT_EMAIL}` },
];

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      role="contentinfo"
      className={cn(
        'relative z-10 border-t border-[var(--color-border)]',
        'bg-cream-300 dark:bg-ink-800',
        'py-12 lg:py-20 mt-12 pb-32',
        className,
      )}
    >
      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
        <BrandColumn />
        <LinkColumn title="Platform" links={PLATFORM_LINKS} />
        <LinkColumn title="Partners" links={PARTNER_LINKS} external />
      </div>

      <DisclaimerBox />
    </footer>
  );
}

/* ============================== 내부 컴포넌트 ============================== */

function BrandColumn() {
  const { t } = useLocale();
  return (
    <div className="col-span-1 sm:col-span-2">
      <h2 className="mb-3">
        <Logo className="h-6 lg:h-7" />
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {t('footer.tagline1')}
        <br className="hidden md:block" />
        {t('footer.tagline2')}
      </p>
      <div className="flex gap-3">
        <SocialLink
          href="https://instagram.com"
          label="Instagram"
          icon={<Instagram className="size-4" aria-hidden />}
        />
        <SocialLink href="https://x.com" label="X" icon={<XLogo className="size-4" />} />
      </div>
    </div>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="p-2.5 rounded-pill bg-surface text-foreground hover:bg-lime-300 hover:text-ink-900 transition-colors"
    >
      {icon}
    </a>
  );
}

interface LinkColumnProps {
  title: string;
  links: ReadonlyArray<{ labelKey: MessageKey; href: string }>;
  external?: boolean;
}

function LinkColumn({ title, links, external }: LinkColumnProps) {
  const { t, locale } = useLocale();
  const mailSubject = (key: MessageKey) => {
    const subjects: Record<string, Record<typeof locale, string>> = {
      'footer.partnerReg': {
        ko: 'POP-SPOT 파트너 등록 문의',
        en: 'POP-SPOT partnership inquiry',
        ja: 'POP-SPOT パートナー登録のお問い合わせ',
      },
      'footer.business': {
        ko: 'POP-SPOT 비즈니스 문의',
        en: 'POP-SPOT business inquiry',
        ja: 'POP-SPOT ビジネスのお問い合わせ',
      },
      'footer.ads': {
        ko: 'POP-SPOT 광고 안내 문의',
        en: 'POP-SPOT advertising inquiry',
        ja: 'POP-SPOT 広告のお問い合わせ',
      },
    };
    return subjects[key]?.[locale];
  };
  return (
    <div>
      <h4 className="font-bold mb-5 uppercase tracking-[0.15em] text-xs text-foreground">
        {title}
      </h4>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {links.map((l) =>
          external ? (
            <li key={l.labelKey}>
              <a
                href={`${l.href}?subject=${encodeURIComponent(mailSubject(l.labelKey) ?? 'POP-SPOT')}`}
                className="hover:text-lime-500 transition-colors"
              >
                {t(l.labelKey)}
              </a>
            </li>
          ) : (
            <li key={l.labelKey}>
              <Link
                href={localizedPath(l.href, locale)}
                className="hover:text-lime-500 transition-colors"
              >
                {t(l.labelKey)}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function DisclaimerBox() {
  const { t, locale } = useLocale();
  return (
    <div className="mt-12 pt-8 border-t border-[var(--color-border)] text-center max-w-[1200px] mx-auto px-6">
      <div className="rounded-lg p-5 text-sm md:text-xs text-muted-foreground leading-relaxed border border-[var(--color-border)] bg-surface/50">
        <p className="font-bold mb-2 text-foreground">{t('footer.noticeHead')}</p>
        <p className="mb-2">
          {t('footer.noticePay')} {t('footer.noticePayTail')}
        </p>
        <p>
          {t('footer.noticeSource')}{' '}
          <Link href={localizedPath('/terms', locale)} className="text-lime-500 hover:underline">
            {t('footer.terms')} §10
          </Link>{' '}
          {t('footer.noticeSourceTail')}
        </p>
        <p className="mt-2">
          {t('footer.noticePhoto')}{' '}
          <a
            href="https://www.pexels.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-lime-500 hover:underline"
          >
            Photos provided by Pexels
          </a>
          {t('footer.noticePhotoTail')}
        </p>
        <p>
          {t('footer.noticeReport')} <strong>{t('footer.noticeReportStrong')}</strong>
          {t('footer.noticeReportTail')}
        </p>
        <p className="mt-3 font-bold">
          {t('footer.contact')}:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lime-500 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
        {/* v2.18.1 — 운영자 정보. 사업자 / 통신판매업 신고는 실제 운영 시작 시 채워 넣기. */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-1 md:grid-cols-2 gap-1 text-xs md:text-[10px] text-muted-foreground/80">
          <p>{t('footer.provider')}</p>
          <p>{t('footer.hosting')}</p>
          <p>{t('footer.revenue')}</p>
          <p>{t('footer.noPayment')}</p>
        </div>

        <SectionLogo
          name="powered-by"
          label="Powered by popspot"
          className="mt-4 h-4 text-muted-foreground/80"
        />
        <p className="mt-2 opacity-60">
          © {new Date().getFullYear()} POP-SPOT. All rights reserved.
        </p>
      </div>
    </div>
  );
}
