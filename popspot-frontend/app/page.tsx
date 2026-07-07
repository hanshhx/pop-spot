import { Suspense } from "react";
import type { Metadata } from "next";

import HomeClient from "./HomeClient";
import { REGIONS } from "@/lib/regions";
import { CATEGORIES } from "@/lib/popupSlices";

/**
 * v2.32 — 메인 페이지 SEO 강화.
 *
 * <p>기존 메인은 {@code "use client"} + {@code useSearchParams()} 라 본문이 SSR 되지 않고 스피너로만
 * 서버 렌더됐다 → 구글이 메인을 색인·노출하기 어려웠다(브랜드어로만 잡힘). 실제 앱(HomeClient)은 그대로 두되,
 * 이 서버 컴포넌트 래퍼가 **크롤러가 읽는 서버 렌더 SEO 블록**(H1·설명·지역/카테고리 내부 링크)을 앞에 두어
 * 메인이 "서울 팝업스토어" 등 헤드 키워드로 색인·노출되게 한다. sr-only 라 사용자 화면엔 변화 없음.
 */

export const metadata: Metadata = {
  title: "서울 팝업스토어 지도 · 오늘 여는 팝업 한눈에",
  description:
    "성수 · 한남 · 압구정 · 홍대 · 강남 · 잠실 등 서울 팝업스토어 일정과 위치를 지도 한 장에. 위시리스트, 마감 D-3 알림, 같이 갈 동행 매칭까지 무료. 매일 04·16시 자동 업데이트.",
  alternates: { canonical: "https://popspot.co.kr" },
};

export default function Page() {
  return (
    <>
      {/* 서버 렌더 SEO 본문 — 크롤러용(sr-only). 실제 인터랙션은 아래 HomeClient. */}
      <section className="sr-only">
        <h1>서울 팝업스토어 지도 — 오늘 여는 팝업 한눈에 | 팝스팟(POP-SPOT)</h1>
        <p>
          성수 · 한남 · 압구정 · 홍대 · 강남 · 잠실 · 여의도 · 명동 등 서울 곳곳의 팝업스토어 일정과 위치를
          지도 한 장에 모았습니다. 위시리스트, 마감 D-3 알림, 같이 갈 동행 매칭까지 무료로 이용하세요. 매일
          04시 · 16시 자동 업데이트되는 서울 팝업스토어 추천 · 캘린더 서비스입니다.
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
