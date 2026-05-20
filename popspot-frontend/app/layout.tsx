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
    "성수 · 한남 · 압구정. 서울 모든 팝업을 한 화면에서. 실시간 혼잡도, AI 코스 추천, 친구와 동선 계획까지.",
  keywords: ["팝업스토어", "서울 팝업", "성수동 팝업", "POP-SPOT", "팝업 캘린더"],
  openGraph: {
    title: "POP-SPOT — 서울 팝업스토어 인텔리전스",
    description: "서울의 모든 팝업, 한 화면에.",
    type: "website",
    locale: "ko_KR",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
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
