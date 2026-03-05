import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script"; 
import { Providers } from "./Providers"; 
// 🔥 [수정됨] 실제 파일 위치인 src 폴더를 포함하여 경로 수정
import AuthGuard from "../src/components/AuthGuard"; 

// 🔥 [수정] 경로 수정: app 폴더에서 나와서(../) src 폴더로 들어가도록 변경
import GlobalChatManager from "../src/components/GlobalChatManager"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POP-SPOT",
  description: "Find Your Vibe in Seoul",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* [핵심 수정 사항] 
          1. bg-white dark:bg-black: 배경색 지정
          2. text-gray-900 dark:text-white: 글자색 자동 전환
          3. transition-colors: 부드러운 전환 효과
      */}
      <body className={`${inter.className} bg-white dark:bg-black text-gray-900 dark:text-white transition-colors duration-300 min-h-screen`}>
        
        <Providers>
          {/* AuthGuard로 감싸서 로그인 체크 수행 */}
          <AuthGuard>
            {children}

            {/* 🔥 [추가] 전역 채팅 관리자 배치
                이제 어떤 페이지(Page A -> Page B)로 이동해도 
                이 컴포넌트는 언마운트되지 않고 계속 떠있습니다. 
            */}
            <GlobalChatManager />
            
          </AuthGuard>
        </Providers>
        
        <Script
          src="//dapi.kakao.com/v2/maps/sdk.js?appkey=ed46603fb133bbedb6eb40c5fe4b0278&autoload=false"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}