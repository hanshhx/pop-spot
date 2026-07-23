import { Suspense } from 'react';
import type { Metadata } from 'next';

import HomeClient from './HomeClient';
import { REGIONS } from '@/lib/regions';
import { CATEGORIES, BRANDS } from '@/lib/popupSlices';
import { CRAWL_REFRESH_SENTENCE } from '@/lib/siteCopy';

/**
 * v2.32 — 메인 페이지 SEO 강화.
 *
 * <p>기존 메인은 {@code "use client"} + {@code useSearchParams()} 라 본문이 SSR 되지 않고 스피너로만
 * 서버 렌더됐다 → 구글이 메인을 색인·노출하기 어려웠다(브랜드어로만 잡힘). 실제 앱(HomeClient)은 그대로 두되,
 * 이 서버 컴포넌트 래퍼가 **크롤러가 읽는 서버 렌더 SEO 블록**(H1·설명·지역/카테고리 내부 링크)을 앞에 두어
 * 메인이 "서울 팝업스토어" 등 헤드 키워드로 색인·노출되게 한다. sr-only 라 사용자 화면엔 변화 없음.
 */

export const metadata: Metadata = {
  // 헤드 키워드 전면 배치: "팝업스토어 일정"(급상승) · "서울 팝업스토어" · "지도" · "오늘·이번주 팝업".
  title: '서울 팝업스토어 일정·지도 | 오늘·이번주 여는 팝업 한눈에 · 팝스팟',
  // 네이버 권장(80자 이내)에 맞춰 압축 — 핵심 키워드는 유지.
  description:
    '서울 팝업스토어 일정·위치를 지도 한 장에. 오늘·이번 주·주말 여는 성수·홍대·강남 팝업과 마감 임박까지 무료로 한눈에.',
  alternates: { canonical: 'https://popspot.co.kr' },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="order-2 border-t border-[var(--color-border)] px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-black tracking-tight">서울 팝업스토어 일정과 지도</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            서울에서 열리는 팝업의 장소와 기간을 지도·목록·캘린더로 확인할 수 있음. 정보는{' '}
            {CRAWL_REFRESH_SENTENCE}되며, 실제 방문 전에는 연결된 원문에서 변경 여부를 한 번 더
            확인하는 것을 권장함.
          </p>
          <nav className="mt-8" aria-label="지역별 서울 팝업스토어">
            <h2>지역별 팝업스토어</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <li key={r.slug}>
                  <a
                    className="inline-flex min-h-10 items-center rounded-full border border-[var(--color-border)] px-3 text-sm hover:border-lime-300"
                    href={`/popups/${r.slug}`}
                  >
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="mt-8" aria-label="카테고리별 팝업스토어">
            <h2>카테고리별 팝업스토어</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <a
                    className="inline-flex min-h-10 items-center rounded-full border border-[var(--color-border)] px-3 text-sm hover:border-lime-300"
                    href={`/popups/${c.slug}`}
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="mt-8" aria-label="브랜드·IP별 팝업스토어">
            <h2>브랜드·IP·인기 장소 팝업스토어</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {BRANDS.map((b) => (
                <li key={b.slug}>
                  <a
                    className="inline-flex min-h-10 items-center rounded-full border border-[var(--color-border)] px-3 text-sm hover:border-lime-300"
                    href={`/popups/${b.slug}`}
                  >
                    {b.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <div className="order-1">
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime-300 border-t-transparent" />
            </div>
          }
        >
          <HomeClient />
        </Suspense>
      </div>
    </div>
  );
}
