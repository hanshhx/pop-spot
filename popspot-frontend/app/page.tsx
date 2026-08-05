import { Suspense } from 'react';
import type { Metadata } from 'next';

import HomeClient from './HomeClient';
import { fetchHomePopups } from './homeData';
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
  title: '서울 팝업스토어 일정·지도 | 오늘·이번주 여는 팝업 한눈에',
  // 네이버 권장(80자 이내)에 맞춰 압축 — 핵심 키워드는 유지.
  description:
    '서울 팝업스토어 일정·위치를 지도 한 장에. 오늘·이번 주·주말 여는 성수·홍대·강남 팝업과 마감 임박까지 무료로 한눈에.',
  keywords: [
    '팝업스토어 일정',
    '서울 팝업스토어',
    '서울 팝업 지도',
    '이번주 팝업',
    '오늘 팝업',
    '성수 팝업',
    '잠실 팝업',
    '팝스팟',
  ],
  openGraph: {
    title: '서울 팝업스토어 일정·지도 | 오늘·이번주 여는 팝업 한눈에',
    description:
      '서울 팝업스토어 일정·위치를 지도 한 장에. 오늘·이번 주·주말 여는 성수·홍대·강남 팝업과 마감 임박까지 무료로 한눈에.',
    type: 'website',
    locale: 'ko_KR',
    url: 'https://popspot.co.kr',
    siteName: 'POP-SPOT',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '서울 팝업스토어 일정·지도 | 오늘·이번주 여는 팝업 한눈에',
    description:
      '서울 팝업스토어 일정·위치를 지도 한 장에. 오늘·이번 주·주말 여는 성수·홍대·강남 팝업과 마감 임박까지 무료로 한눈에.',
    images: ['/og-image.png'],
  },
  // hreflang 은 양방향이어야 한다 — /en·/ja 만 이쪽을 가리키고 이쪽이 그들을 안 가리키면
  // 검색엔진이 연결을 무시한다. 한쪽만 선언하면 언어별 주소를 만든 의미가 사라진다.
  alternates: localeAlternates('ko'),
};

/**
 * 목록을 <b>서버에서 먼저 받아</b> HomeClient 에 넘긴다.
 *
 * <p>그전에는 홈이 빈 상태로 그려진 뒤 마운트 후 백엔드를 두드렸다. 백엔드가 집 VM + Funnel 이라
 * 첫 화면이 그 왕복을 기다렸고, 백엔드가 죽으면 홈이 통째로 비었다. 자세한 근거는
 * {@link fetchHomePopups} 주석에 적어 두었다.
 *
 * <p>실패해도 빈 배열이 넘어갈 뿐이라, 그 경우 예전과 똑같이 클라이언트가 받아온다.
 */
export default async function Page() {
  const initialPopups = await fetchHomePopups();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime-300 border-t-transparent" />
        </div>
      }
    >
      <HomeClient initialPopups={initialPopups} />
    </Suspense>
  );
}
