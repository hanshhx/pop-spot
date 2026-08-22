import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import VisitTracker from '@/components/VisitTracker';
import { Providers } from './Providers';
import { LocaleProvider } from '@/lib/i18n';
import AuthGuard from '@/components/AuthGuard';
import GlobalChatManager from '@/components/GlobalChatManager';
import { MusicPlayerProvider } from '@/components/music/MusicPlayerProvider';
import { GlobalMusicPlayer } from '@/components/music/GlobalMusicPlayer';
import ServiceStatusBanner from '@/components/ServiceStatusBanner';
import { SEASON_COOKIE, parseSeasonSetting, resolveSeason } from '@/lib/seasonOverride';
import { ogImageFor } from '@/lib/seasonOgImage';

export async function generateMetadata(): Promise<Metadata> {
  /* 공유 카드는 계절을 따른다. 정적 상수로 두면 계절이 바뀌어도 8월 카드가 계속 나간다.
     파일이 아직 없는 계절은 기본 카드로 물러선다(lib/seasonOgImage). */
  const store = await cookies();
  const season = resolveSeason(parseSeasonSetting(store.get(SEASON_COOKIE)?.value));
  const ogImage = ogImageFor(season);

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

/**
 * v2.17 — JSON-LD 구조화 데이터.
 * 검색 결과에 sitelinks search box / 조직 정보 풍부도 향상.
 */
function jsonLdFor(locale: 'ko' | 'en' | 'ja') {
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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F3EE' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const headerLocale = requestHeaders.get('x-popspot-locale');
  const locale = headerLocale === 'en' || headerLocale === 'ja' ? headerLocale : 'ko';
  const jsonLd = jsonLdFor(locale);

  /* 계절은 관리자가 고정해 둔 값이 있으면 그것을, 없으면 날짜를 따른다.
     쿠키라서 서버가 그리는 첫 HTML 부터 맞는 계절이 실린다 — 브라우저에서 정하면 한 번 깜빡인다. */
  const cookieStore = await cookies();
  const season = resolveSeason(parseSeasonSetting(cookieStore.get(SEASON_COOKIE)?.value));

  return (
    /* Proxy가 주소의 /en·/ja 접두어를 요청 헤더로 넘긴다. 루트 레이아웃에서 이를 읽어 서버가 보내는
       첫 HTML부터 올바른 lang과 언어별 JSON-LD를 넣는다. 브라우저에서 뒤늦게 바꾸는 방식은
       화면 낭독기와 자바스크립트를 적게 실행하는 검색로봇이 한국어 문서로 오인할 수 있다. */
    <html lang={locale} data-season={season} suppressHydrationWarning>
      <head>
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
            <ServiceStatusBanner />
            <AuthGuard>
              <MusicPlayerProvider>
                {children}
                <GlobalChatManager />
                <GlobalMusicPlayer />
              </MusicPlayerProvider>
            </AuthGuard>
          </LocaleProvider>
        </Providers>

        {/* 익명 방문 비콘(어드민 방문 통계용) + Vercel Web Analytics.
            SpeedInsights 는 실사용자 Core Web Vitals(LCP/CLS/INP) 실측 — 지도(MapLibre) 렌더
            성능 개선이 실제로 효과가 있었는지 합성 점수가 아닌 실측으로 확인하기 위해 붙인다. */}
        <VisitTracker />
        <Analytics />
        <SpeedInsights />

        {/* v2.41 — Kakao Map SDK 로더 제거.
            지도는 v2.36 에 MapLibre 로 교체됐는데 SDK 스크립트만 남아 strategy="beforeInteractive"
            로 전 페이지에서 렌더 블로킹 로드되고 있었다. 유일한 소비자 사슬(KakaoRoadview →
            DigitalTicket)이 어디서도 import 되지 않는 죽은 코드라 로더와 함께 삭제한다. */}
      </body>
    </html>
  );
}
