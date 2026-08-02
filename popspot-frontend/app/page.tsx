import { Suspense } from 'react';
import type { Metadata } from 'next';

import HomeClient from './HomeClient';
import { REGIONS } from '@/lib/regions';
import { CATEGORIES, BRANDS, getPeriods } from '@/lib/popupSlices';
import { CRAWL_REFRESH_SENTENCE } from '@/lib/siteCopy';
import { localeAlternates } from '@/lib/localeRoutes';

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
  // hreflang 은 양방향이어야 한다 — /en·/ja 만 이쪽을 가리키고 이쪽이 그들을 안 가리키면
  // 검색엔진이 연결을 무시한다. 한쪽만 선언하면 언어별 주소를 만든 의미가 사라진다.
  alternates: localeAlternates('ko'),
};

export default function Page() {
  return (
    <>
      {/* 서버 렌더 SEO 본문 — 크롤러용(sr-only). 실제 인터랙션은 아래 HomeClient. */}
      <section className="sr-only">
        <h1>서울 팝업스토어 일정·지도 — 오늘·이번주 여는 팝업 한눈에 | 팝스팟(POP-SPOT)</h1>
        <p>
          성수 · 한남 · 압구정 · 홍대 · 강남 · 잠실 · 여의도 · 명동 · 더현대 서울 · 용산 아이파크몰
          등 서울 곳곳의 팝업스토어 일정과 위치를 지도 한 장에 모았습니다. 오늘 · 이번 주 · 이번
          주말 · 이번 달 여는 팝업, 신상 · 마감 임박 팝업, 패션 · 뷰티 · 캐릭터 · 브랜드 · IP
          팝업까지 한눈에 확인하세요. 마음에 드는 팝업은 위시리스트에 담아 마감일을 놓치지 마세요.{' '}
          {CRAWL_REFRESH_SENTENCE}되는 서울 팝업스토어 추천 · 일정 · 지도 · 캘린더 서비스입니다.
        </p>
        <p>
          팝스팟은 서울에서 지금 열리는 팝업스토어를 매일 자동으로 모아 지도와 캘린더로 보여주는
          팝업 일정 서비스입니다. 팝업스토어 추천, 이번 주 팝업, 주말 팝업, 신상 팝업을 한 곳에서
          확인하고 마음에 드는 팝업은 위시리스트에 담아 마감일을 확인하세요.
        </p>
        <nav aria-label="지역별 서울 팝업스토어">
          <h2>지역별 팝업스토어</h2>
          <ul>
            {REGIONS.map((r) => (
              <li key={r.slug}>
                <a href={`/popups/${r.slug}`}>{r.label} 팝업스토어</a>
              </li>
            ))}
          </ul>
        </nav>
        {/*
          v2.53 — 시점 링크가 여기만 빠져 있었다. /popups/today · this-week · this-weekend 는 이미
          빌드되고 sitemap 에도 올라가는데 홈에서 거기로 가는 링크가 없어, "팝업스토어 일정" 류
          검색어를 받을 페이지가 사실상 고아였다. 별도 페이지를 만들 필요가 없고 링크만 있으면 된다.

          라벨은 getPeriods() 를 그 자리에서 부른다 — 상수로 굳히면 "이번 주 (7/20~7/26)" 가 박힌다.
        */}
        <nav aria-label="시점별 팝업스토어">
          <h2>일정별 팝업스토어</h2>
          <ul>
            {getPeriods().map((p) => (
              <li key={p.slug}>
                <a href={`/popups/${p.slug}`}>{p.label} 여는 팝업스토어</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="카테고리별 팝업스토어">
          <h2>카테고리별 팝업스토어</h2>
          <ul>
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <a href={`/popups/${c.slug}`}>{c.label} 팝업스토어</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="브랜드·IP별 팝업스토어">
          <h2>브랜드·IP·인기 장소 팝업스토어</h2>
          <ul>
            {BRANDS.map((b) => (
              <li key={b.slug}>
                <a href={`/popups/${b.slug}`}>{b.label} 팝업스토어</a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime-300 border-t-transparent" />
          </div>
        }
      >
        <HomeClient />
      </Suspense>
    </>
  );
}
