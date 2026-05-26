import Link from 'next/link';
import { Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * X (구 Twitter) 브랜드 로고 — lucide-react 가 리브랜딩된 X 로고를 제공하지 않아 inline SVG 로 처리.
 * viewBox 24x24, 단색 currentColor 로 부모 className 의 색상을 상속받는다.
 */
function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
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
const MAIL_SUBJECT_PARTNER = 'POP-SPOT 파트너 등록 문의';
const MAIL_SUBJECT_BUSINESS = 'POP-SPOT 비즈니스 문의';
const MAIL_SUBJECT_AD = 'POP-SPOT 광고 안내 문의';

const PLATFORM_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: '지도 보기', href: '/' },
  { label: '팝업 캘린더', href: '/' },
  { label: 'AI 혼잡도 분석', href: '/' },
  { label: '매거진', href: '/' },
  { label: '서비스 소개', href: '/about' },
  { label: '의견 보내기', href: '/feedback' },
  { label: '이용약관', href: '/terms' },
  { label: '개인정보 처리방침', href: '/privacy' },
];

const PARTNER_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: '파트너 등록', href: `mailto:${CONTACT_EMAIL}?subject=${MAIL_SUBJECT_PARTNER}` },
  { label: '비즈니스 문의', href: `mailto:${CONTACT_EMAIL}?subject=${MAIL_SUBJECT_BUSINESS}` },
  { label: '광고 안내', href: `mailto:${CONTACT_EMAIL}?subject=${MAIL_SUBJECT_AD}` },
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
  return (
    <div className="col-span-1 sm:col-span-2">
      <h2 className="font-display-en text-2xl lg:text-3xl font-extrabold tracking-tighter mb-3 text-foreground">
        POP-SPOT<span className="text-lime-300">.</span>
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        서울 팝업스토어 정보를 한곳에 모아둔 곳.
        <br className="hidden md:block" />
        매일 새로 열리는 팝업을 찾고, 가고, 기록해요.
      </p>
      <div className="flex gap-3">
        <SocialLink href="https://instagram.com" label="Instagram" icon={<Instagram className="size-4" aria-hidden />} />
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
  links: ReadonlyArray<{ label: string; href: string }>;
  external?: boolean;
}

function LinkColumn({ title, links, external }: LinkColumnProps) {
  return (
    <div>
      <h4 className="font-bold mb-5 uppercase tracking-[0.15em] text-xs text-foreground">{title}</h4>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {links.map((l) =>
          external ? (
            <li key={l.label}>
              <a href={l.href} className="hover:text-lime-500 transition-colors">
                {l.label}
              </a>
            </li>
          ) : (
            <li key={l.label}>
              <Link href={l.href} className="hover:text-lime-500 transition-colors">
                {l.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function DisclaimerBox() {
  return (
    <div className="mt-12 pt-8 border-t border-[var(--color-border)] text-center max-w-[1200px] mx-auto px-6">
      <div className="rounded-lg p-5 text-xs text-muted-foreground leading-relaxed border border-[var(--color-border)] bg-surface/50">
        <p className="font-bold mb-2 text-foreground">
          [정보 안내] 서울 팝업스토어 정보를 모아 안내하는 서비스입니다.
        </p>
        <p className="mb-2">
          본 서비스는 실제 티켓 예매 및 금전적 거래를 처리하지 않습니다. 팝업스토어 자체의 입장 / 예약 / 구매는 각 운영사의 공식 채널을 이용해 주세요.
        </p>
        <p>
          팝업스토어 정보 일부는 공개된 검색 API (네이버 · 카카오) 와 사용자 제보를 기반으로 자동 / 수동 수집 · 정리됩니다.
          정보 정확성을 보장하지 않으며, 자세한 내용은{' '}
          <Link href="/terms" className="text-lime-500 hover:underline">
            이용약관 §10
          </Link>{' '}
          를 참고해주세요.
        </p>
        <p>
          저작권 · 정보 오류 등으로 정보 삭제 · 수정이 필요한 경우 각 팝업 상세페이지의 신고 버튼 또는 아래 이메일로 연락
          주시면 <strong>접수 즉시 노출이 차단되며 24시간 내 조치</strong>됩니다.
        </p>
        <p className="mt-3 font-bold">
          개인정보 보호 / 권리자 문의:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lime-500 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-3 opacity-60">© {new Date().getFullYear()} POP-SPOT. All rights reserved.</p>
      </div>
    </div>
  );
}
