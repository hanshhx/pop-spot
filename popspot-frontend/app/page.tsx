import { Suspense } from 'react';
import type { Metadata } from 'next';

import HomeClient from './HomeClient';
import { fetchHomePopups } from './homeData';
import { localeAlternates } from '@/lib/localeRoutes';
import { isOpenNow, kstTodayStart } from '@/lib/popupSlices';
import { countGoAble } from '@/lib/mappableCount';
import { CLOSING_SOON_DAYS, homeMeta, type HomeCounts } from '@/lib/homeMeta';

/**
 * v2.32 — 메인 페이지 SEO 강화.
 *
 * <p>기존 메인은 {@code "use client"} + {@code useSearchParams()} 라 본문이 SSR 되지 않고 스피너로만
 * 서버 렌더됐다 → 구글이 메인을 색인·노출하기 어려웠다(브랜드어로만 잡힘). 실제 앱(HomeClient)은 그대로 두되,
 * 이 서버 컴포넌트 래퍼가 **크롤러가 읽는 서버 렌더 SEO 블록**(H1·설명·지역/카테고리 내부 링크)을 앞에 두어
 * 메인이 "서울 팝업스토어" 등 헤드 키워드로 색인·노출되게 한다. sr-only 라 사용자 화면엔 변화 없음.
 */

/**
 * 지금 열려 있는 팝업 수와 마감 임박 수.
 *
 * <p>실패해도 페이지가 죽으면 안 되므로 값을 못 구하면 {@code null} 을 돌려주고, 문장은 숫자 없는
 * 옛 형태로 돌아간다 — 메타 문구 하나 때문에 홈이 500 이 되면 안 된다.
 */
async function liveCounts(): Promise<HomeCounts | null> {
  try {
    const popups = await fetchHomePopups();
    /* 화면이 내거는 그 수와 같아야 한다 — 정의는 countGoAble 한 곳에 있다. */
    const open = countGoAble(popups);
    if (open === 0) return null;

    const today = kstTodayStart();
    const soon = new Date(today.getTime() + CLOSING_SOON_DAYS * 86_400_000);
    const closingSoon = popups.filter((popup) => {
      if (!isOpenNow(popup.startDate, popup.endDate, today)) return false;
      const end = popup.endDate ? new Date(`${popup.endDate}T00:00:00+09:00`) : null;
      return end !== null && !Number.isNaN(end.getTime()) && end <= soon;
    }).length;
    return { open, closingSoon };
  } catch {
    /* 메타 문구 하나 때문에 홈이 500 이 되면 안 된다. 숫자를 못 구하면 옛 문장으로 돌아간다. */
    return null;
  }
}

/** 검색 결과에 <b>구체적인 수</b>를 내보낸다. 경위와 규칙은 {@link homeMeta} 에 있다. */
export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = homeMeta(await liveCounts());

  return {
    title,
    description,
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
      title,
      description,
      type: 'website',
      locale: 'ko_KR',
      url: 'https://popspot.co.kr',
      siteName: 'POP-SPOT',
      images: ['/og-image.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
    // hreflang 은 양방향이어야 한다 — /en·/ja 만 이쪽을 가리키고 이쪽이 그들을 안 가리키면
    // 검색엔진이 연결을 무시한다. 한쪽만 선언하면 언어별 주소를 만든 의미가 사라진다.
    alternates: localeAlternates('ko'),
  };
}

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
