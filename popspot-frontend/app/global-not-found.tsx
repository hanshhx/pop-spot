import Link from 'next/link';
import type { Metadata } from 'next';

import { SiteDocument, siteViewport } from '@/app/SiteDocument';

/**
 * 어느 트리에도 속하지 않는 주소의 404.
 *
 * <p><b>이 파일이 없으면 404 가 껍데기를 통째로 잃는다.</b> 루트 레이아웃을 셋으로 쪼개면서
 * {@code app/layout.tsx} 가 사라졌는데, 그러면 Next 는 {@code /_not-found} 를 자기 내장
 * 레이아웃({@code next/dist/client/components/builtin/layout.js})으로 그린다. 그 파일은
 * {@code <html><body>{children}</body></html>} 뿐이라 <b>{@code lang} 속성도 전역 CSS 도 없다.</b>
 * 검증 단계에서 실제 빌드로 확인된 사항이다.
 *
 * <p>{@link SiteDocument} 를 그대로 쓰면 {@code lang}·{@code data-season}·전역 CSS·사이트 껍데기가
 * 전부 살아난다. 로케일은 {@code ko} 로 둔다 — 어느 트리에도 안 걸린 주소라 알 방법이 없고,
 * 이 사이트의 기본 언어가 한국어다.
 */
export const metadata: Metadata = {
  title: '찾을 수 없는 페이지 · POP-SPOT',
  robots: { index: false, follow: false },
};

export const viewport = siteViewport;

export default function GlobalNotFound() {
  return (
    <SiteDocument locale="ko">
      <main className="flex min-h-[70svh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-black tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
          찾을 수 없는 페이지예요
        </h1>
        <p className="max-w-[46ch] text-sm text-muted-foreground">
          주소가 바뀌었거나 팝업이 내려갔을 수 있어요. 홈에서 지금 열려 있는 팝업을 확인해 보세요.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex min-h-11 items-center rounded-pill bg-lime-300 px-5 text-sm font-black text-ink-900 transition hover:brightness-105"
        >
          홈으로 가기
        </Link>
      </main>
    </SiteDocument>
  );
}
