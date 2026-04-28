import Link from "next/link";
import { Instagram, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

const PLATFORM_LINKS = [
  { label: "지도 보기", href: "/" },
  { label: "팝업 캘린더", href: "/" },
  { label: "AI 혼잡도 분석", href: "/" },
  { label: "매거진", href: "/" },
  // [V4] 자동수집 운영 시 가시성 필수 — 사용자가 약관/신고 절차에 접근 가능해야 함
  { label: "이용약관", href: "/terms" },
];

const PARTNER_LINKS = [
  { label: "파트너 등록", href: "mailto:reo4321@naver.com?subject=POP-SPOT 파트너 등록 문의" },
  { label: "비즈니스 문의", href: "mailto:reo4321@naver.com?subject=POP-SPOT 비즈니스 문의" },
  { label: "광고 안내", href: "mailto:reo4321@naver.com?subject=POP-SPOT 광고 안내 문의" },
];

/**
 * 사이트 공통 푸터.
 * - 더미 링크(#) 제거 — 외부 메일/내부 라우트로만 연결
 * - 포트폴리오 안내문 포함
 */
export function Footer({ className }: FooterProps) {
  return (
    <footer
      role="contentinfo"
      className={cn(
        "relative z-10 border-t border-[var(--color-border)]",
        "bg-cream-300 dark:bg-ink-800",
        "py-12 lg:py-20 mt-12 pb-32",
        className
      )}
    >
      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
        <div className="col-span-1 sm:col-span-2">
          <h2 className="font-display-en text-2xl lg:text-3xl font-extrabold tracking-tighter mb-3 text-foreground">
            POP-SPOT<span className="text-lime-300">.</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
            서울의 모든 팝업스토어를 연결합니다.
            <br className="hidden md:block" />
            데이터 기반의 스마트한 오프라인 경험을 제공합니다.
          </p>
          <div className="flex gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="p-2.5 rounded-pill bg-surface text-foreground hover:bg-lime-300 hover:text-ink-900 transition-colors"
            >
              <Instagram className="size-4" aria-hidden />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="p-2.5 rounded-pill bg-surface text-foreground hover:bg-lime-300 hover:text-ink-900 transition-colors"
            >
              <Twitter className="size-4" aria-hidden />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-bold mb-5 uppercase tracking-[0.15em] text-xs text-foreground">
            Platform
          </h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {PLATFORM_LINKS.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="hover:text-lime-500 transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-5 uppercase tracking-[0.15em] text-xs text-foreground">
            Partners
          </h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {PARTNER_LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="hover:text-lime-500 transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-[var(--color-border)] text-center max-w-[1200px] mx-auto px-6">
        <div className="rounded-lg p-5 text-xs text-muted-foreground leading-relaxed border border-[var(--color-border)] bg-surface/50">
          <p className="font-bold mb-2 text-foreground">
            [포트폴리오 안내] 본 사이트는 상업적 목적이 없는 개인 개발용 포트폴리오입니다.
          </p>
          <p className="mb-2">
            제공되는 모든 팝업 정보, 이미지, 혼잡도 데이터는 학습 목적으로 크롤링되거나
            시뮬레이션된 데이터이며 실제와 다를 수 있습니다.
            <br className="hidden md:block" />
            실제 티켓 예매 및 결제는 이루어지지 않으며, 금전적 거래를 요구하지 않습니다.
          </p>
          <p>
            팝업스토어 정보 일부는 공개된 검색 API (네이버·카카오) 와 사용자 제보를 기반으로
            자동/수동 수집·정리됩니다. 정보 정확성을 보장하지 않으며, 자세한 내용은{" "}
            <Link href="/terms" className="text-lime-500 hover:underline">
              이용약관 §10
            </Link>{" "}
            를 참고해주세요.
          </p>
          <p>
            저작권·정보 오류 등으로 정보 삭제·수정이 필요한 경우 각 팝업 상세페이지의 신고 버튼 또는
            아래 이메일로 연락 주시면{" "}
            <strong>접수 즉시 노출이 차단되며 24시간 내 조치</strong>됩니다.
          </p>
          <p className="mt-3 font-bold">
            Contact:{" "}
            <a
              href="mailto:reo4321@naver.com"
              className="text-lime-500 hover:underline"
            >
              reo4321@naver.com
            </a>
          </p>
          <p className="mt-3 opacity-60">
            © {new Date().getFullYear()} POP-SPOT Portfolio Project. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
