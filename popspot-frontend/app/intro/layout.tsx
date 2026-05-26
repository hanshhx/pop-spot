import type { Metadata } from "next";

/**
 * v2.17 — /intro 페이지별 메타. 신규 사용자 진입 경로.
 */
export const metadata: Metadata = {
  title: "시작하기",
  description: "POP-SPOT — 서울 팝업스토어를 한 화면에서. 로그인 또는 게스트로 7일 둘러보기.",
  alternates: { canonical: "https://popspot.co.kr/intro" },
  openGraph: {
    title: "POP-SPOT 시작하기",
    description: "서울 팝업스토어를 한 화면에서 둘러보세요.",
    url: "https://popspot.co.kr/intro",
    type: "website",
    locale: "ko_KR",
  },
};

export default function IntroLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
