import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { SiteAnalytics } from '@/components/SiteAnalytics';
import VisitTracker from '@/components/VisitTracker';
import { Providers } from '@/app/Providers';
import { LocaleProvider } from '@/lib/i18n';
import AuthGuard from '@/components/AuthGuard';
import { MusicPlayerProvider } from '@/components/music/MusicPlayerProvider';
import { GlobalMusicPlayer } from '@/components/music/GlobalMusicPlayer';
import ServiceStatusBanner from '@/components/ServiceStatusBanner';
import SeasonQueryOverride from '@/components/SeasonQueryOverride';
import { SEASON_COOKIE, resolveSeason } from '@/lib/season';
import { SeasonProvider } from '@/lib/seasonContext';
import { ogImageFor } from '@/lib/seasonOgImage';

export type SiteLocale = 'ko' | 'en' | 'ja';

/**
 * 사이트의 HTML 문서 한 벌. 루트 레이아웃 셋이 로케일만 바꿔 이것을 부른다.
 *
 * <p><b>왜 루트 레이아웃이 셋인가.</b> 예전에는 {@code app/layout.tsx} 하나가
 * {@code headers().get('x-popspot-locale')} 로 로케일을 알아냈다. 그 한 줄이 <b>886 페이지를
 * 전부 동적 렌더로</b> 떨어뜨렸다 — 동적 API 를 쓰는 레이아웃 아래는 전부 동적이 된다.
 * 2026-09-19 Vercel 이 무료 한도 초과로 배포를 정지시켰을 때 Fluid CPU 가 한도의 2.9배였고,
 * 그 전량이 "정적일 수 있었던 페이지를 매 요청 다시 그린" 값이었다.
 *
 * <p>{@code app/layout.tsx} 를 없애면 Next 는 위에서부터 처음 만난 layout 을 루트로 삼는다
 * (next-app-loader). 그래서 {@code (ko)}·{@code en}·{@code ja} 각각의 layout 이 자기 트리의
 * 루트가 되고, <b>로케일이 빌드 시점 리터럴</b>이 된다. 헤더도 쿠키도 필요 없다.
 *
 * <p>이건 예전보다 <b>튼튼하다</b>. 헤더 방식은 {@code proxy.ts} 가 헤더를 안 붙이면 삼항이
 * 조용히 {@code 'ko'} 로 떨어져서, /en 페이지가 {@code lang="ko"} 로 나가도 아무 증상이 없었다.
 * 리터럴에는 그 실패 모드가 없다.
 */
export function SiteDocument({
  locale,
  children,
}: {
  locale: SiteLocale;
  children: React.ReactNode;
}) {
  /*
   * 계절은 빌드(또는 재검증) 시점의 월로 정한다. 쿠키를 읽지 않는다 — 쿠키를 읽는 순간
   * 이 레이아웃이 동적이 되고, 그러면 위에 적은 문제가 그대로 돌아온다.
   *
   * 관리자 오버라이드는 아래 부트 스크립트가 첫 페인트 전에 정정한다.
   */
  const season = resolveSeason(null, null);
  const jsonLd = jsonLdFor(locale);

  return (
    <html lang={locale} data-season={season} suppressHydrationWarning>
      <head>
        {/*
          계절 정정 — <head> 안의 <b>동기</b> 스크립트다. 파서가 여기서 멈추고 실행을 끝낸 뒤에야
          <body> 로 넘어가므로 <b>첫 프레임부터</b> 올바른 계절이 적용된다.

          layout.tsx 의 옛 주석이 금지한 것은 "브라우저에서 <b>마운트 후</b> 붙이는" 방식이다.
          React 마운트는 첫 페인트 뒤라 색이 튄다 — 그 지적은 옳다. 이 스크립트는 마운트가
          아니라 파싱 중에 돈다. next-themes 가 다크모드 플래시를 없애는 것과 같은 수법이고,
          관측 가능한 플래시가 0 인 유일한 클라이언트 방식이다.

          월 경계 표는 season.ts 의 seasonOfMonth 와 <b>같아야 한다</b>. 갈라지면 서버가 그린
          값과 스크립트가 고친 값이 달라 매번 한 번씩 덮어쓴다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var m=document.cookie.match(/(?:^|; )${SEASON_COOKIE}=([^;]*)/);
var v=m?decodeURIComponent(m[1]):'';
if(v!=='spring'&&v!=='summer'&&v!=='autumn'&&v!=='winter'){
var n=new Date().getMonth()+1;
v=(n>=3&&n<=5)?'spring':(n>=6&&n<=8)?'summer':(n>=9&&n<=11)?'autumn':'winter';}
var e=document.documentElement;if(e.dataset.season!==v)e.dataset.season=v;
}catch(_){}})();`,
          }}
        />
        {/* v2.17 — JSON-LD 구조화 데이터 (WebSite + Organization). 검색 결과 풍부도 ↑. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {/* 언어는 앱 전체가 하나를 공유해야 한다 — 컴포넌트마다 훅을 따로 부르면 상태가 갈려
              홈에서 바꿔도 일부 영역만 그대로 남는다(경위는 i18n.tsx 주석). */}
          <LocaleProvider initialLocale={locale}>
            <SeasonProvider season={season}>
              <SeasonQueryOverride />
              <ServiceStatusBanner />
              <AuthGuard>
                <MusicPlayerProvider>
                  {children}
                  <GlobalMusicPlayer />
                </MusicPlayerProvider>
              </AuthGuard>
            </SeasonProvider>
          </LocaleProvider>
        </Providers>

        {/* 익명 방문 비콘(어드민 방문 통계용) + Vercel Web Analytics.
            SpeedInsights 는 실사용자 Core Web Vitals(LCP/CLS/INP) 실측 — 지도(MapLibre) 렌더
            성능 개선이 실제로 효과가 있었는지 합성 점수가 아닌 실측으로 확인하기 위해 붙인다. */}
        <VisitTracker />
        {/* Analytics 를 한 겹 감싼 이유는 SiteAnalytics 주석 참고 — 내 방문을 빼려면
            beforeSend(함수)를 넘겨야 하는데, 서버 컴포넌트에서 함수는 못 건넌다. */}
        <SiteAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

/**
 * v2.17 — JSON-LD 구조화 데이터.
 * 검색 결과에 sitelinks search box / 조직 정보 풍부도 향상.
 */
function jsonLdFor(locale: SiteLocale) {
  const description = {
    ko: '서울 팝업스토어 정보를 모아 안내하는 서비스',
    en: 'A guide to pop-up stores across Seoul',
    ja: 'ソウルのポップアップストア情報をまとめた案内サービス',
  }[locale];
  const inLanguage = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' }[locale];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'POP-SPOT',
        url: 'https://popspot.co.kr',
        description,
        inLanguage,
      },
      {
        '@type': 'Organization',
        name: 'POP-SPOT',
        url: 'https://popspot.co.kr',
        logo: 'https://popspot.co.kr/og-image.png',
      },
    ],
  };
}

/**
 * 루트 레이아웃 셋이 공유하는 메타데이터.
 *
 * <p><b>예전에는 여기서 계절 쿠키를 읽었다</b>(OG 카드를 계절에 맞추려고). 그 한 줄도 전 페이지를
 * 동적으로 만들었는데, <b>얻은 것이 없었다</b> — OG 태그를 읽는 쪽은 카카오톡·X·구글봇이고
 * 이들은 쿠키를 보내지 않는다. 즉 그 분기는 처음부터 닿은 적 없는 코드였다. 이제 빌드/재검증
 * 시점의 월을 쓴다. 계절 경계는 1년에 네 번뿐이다.
 *
 * <p><b>canonical 은 일부러 예전 그대로 둔다.</b> 지금은 전 페이지가 한국어 홈을 가리키는데,
 * 로케일별로 나누는 편이 맞다. 다만 그건 색인 신호를 움직이는 변경이라 이 커밋에 섞지 않는다 —
 * 레이아웃 이동이 무해했는지부터 확인한 뒤 따로 낸다.
 */
export function siteMetadata(): Metadata {
  const ogImage = ogImageFor(resolveSeason(null, null));

  return {
    metadataBase: new URL('https://popspot.co.kr'),
    title: {
      default: 'POP-SPOT — 서울 팝업스토어 인텔리전스',
      template: '%s · POP-SPOT',
    },
    // 네이버 권장(80자 이내). 페이지별 미지정 시 쓰이는 기본 설명.
    description:
      '서울 팝업스토어 일정을 지도로 한눈에. 성수·홍대·강남 팝업까지 지역·브랜드별로 무료 확인.',
    keywords: ['POP-SPOT', '팝스팟', 'popspot'],
    openGraph: {
      title: 'POP-SPOT — 서울 팝업스토어 인텔리전스',
      description:
        '서울 팝업스토어 일정을 지도로 한눈에. 성수·홍대·강남 팝업까지 지역·브랜드별로 무료 확인.',
      type: 'website',
      locale: 'ko_KR',
      url: 'https://popspot.co.kr',
      siteName: 'POP-SPOT',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'POP-SPOT — 서울 팝업스토어 인텔리전스',
      description:
        '서울 팝업스토어 일정을 지도로 한눈에. 성수·홍대·강남 팝업까지 지역·브랜드별로 무료 확인.',
      images: [ogImage],
    },
    icons: {
      icon: '/icon.svg',
    },
    // v2.20.3 — Naver SearchAdvisor / RSS 리더가 자동 인식하도록 alternate 선언
    alternates: {
      canonical: 'https://popspot.co.kr',
      types: {
        'application/rss+xml': [{ url: '/feed.xml', title: 'POP-SPOT RSS' }],
      },
    },
  };
}

export const siteViewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F3EE' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
};
