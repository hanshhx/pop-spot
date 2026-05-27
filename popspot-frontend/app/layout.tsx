import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { Providers } from "./Providers";
import AuthGuard from "@/components/AuthGuard";
import GlobalChatManager from "@/components/GlobalChatManager";
import { MusicPlayerProvider } from "@/components/music/MusicPlayerProvider";
import { GlobalMusicPlayer } from "@/components/music/GlobalMusicPlayer";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL("https://popspot.co.kr"),
  title: {
    default: "POP-SPOT — 서울 팝업스토어 인텔리전스",
    template: "%s · POP-SPOT",
  },
  description:
    "서울 팝업스토어 정보를 지도로 모아보세요. 성수 · 한남 · 압구정 · 홍대 · 강남 팝업 일정, 위시리스트, D-3 마감 알림, 같이 갈 동행 매칭까지. 무료로 시작하세요.",
  keywords: [
    // 브랜드
    "POP-SPOT",
    "팝스팟",
    "popspot",
    // 핵심 일반어
    "팝업스토어",
    "팝업스토어 추천",
    "팝업스토어 일정",
    "팝업스토어 캘린더",
    "팝업스토어 지도",
    "서울 팝업",
    "서울 팝업스토어",
    // 지역
    "성수동 팝업",
    "성수 팝업스토어",
    "한남동 팝업",
    "압구정 팝업",
    "홍대 팝업",
    "강남 팝업",
    "이태원 팝업",
    // 시점
    "오늘 팝업",
    "이번 주 팝업",
    "주말 팝업",
    "이번 달 팝업",
    "신상 팝업",
    "신규 오픈 팝업",
    // 카테고리
    "패션 팝업",
    "뷰티 팝업",
    "캐릭터 팝업",
    "디저트 팝업",
    "브랜드 팝업스토어",
    // 기능
    "팝업 위시리스트",
    "팝업 알림",
    "팝업 동행",
  ],
  openGraph: {
    title: "POP-SPOT — 서울 팝업스토어 인텔리전스",
    description:
      "서울 팝업스토어 정보를 지도로 모아보세요. 성수 · 한남 · 압구정 · 홍대 · 강남 팝업 일정, 위시리스트, D-3 마감 알림, 같이 갈 동행 매칭.",
    type: "website",
    locale: "ko_KR",
    url: "https://popspot.co.kr",
    siteName: "POP-SPOT",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "POP-SPOT — 서울 팝업스토어 인텔리전스",
    description:
      "서울 팝업스토어 정보를 지도로 모아보세요. 성수 · 한남 · 압구정 · 홍대 · 강남 팝업 일정, 위시리스트, D-3 마감 알림, 같이 갈 동행 매칭.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
  // v2.20.3 — Naver SearchAdvisor / RSS 리더가 자동 인식하도록 alternate 선언
  alternates: {
    canonical: "https://popspot.co.kr",
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "POP-SPOT RSS" }],
    },
  },
};

/**
 * v2.17 — JSON-LD 구조화 데이터.
 * 검색 결과에 sitelinks search box / 조직 정보 풍부도 향상.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "POP-SPOT",
      url: "https://popspot.co.kr",
      description: "서울 팝업스토어 정보를 모아 안내하는 서비스",
      inLanguage: "ko-KR",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://popspot.co.kr/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: "POP-SPOT",
      url: "https://popspot.co.kr",
      logo: "https://popspot.co.kr/og-image.png",
      sameAs: [],
    },
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3EE" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* v2.17 — JSON-LD 구조화 데이터 (WebSite + Organization). 검색 결과 풍부도 ↑. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <AuthGuard>
            <MusicPlayerProvider>
              {children}
              <GlobalChatManager />
              <GlobalMusicPlayer />
            </MusicPlayerProvider>
          </AuthGuard>
        </Providers>

        {env.kakaoMapKey && (
          <Script
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${env.kakaoMapKey}&autoload=false`}
            strategy="beforeInteractive"
          />
        )}
      </body>
    </html>
  );
}
