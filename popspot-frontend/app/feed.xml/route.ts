import { NextResponse } from "next/server";

/**
 * v2.20.3 — RSS 2.0 피드 (Naver SearchAdvisor / 일반 RSS 리더용).
 *
 * <p>운영자가 직접 작성한 정적 페이지만 노출. 약관 §10-2 (Naver/Kakao 검색 결과 재현 금지) 와
 * 일관성 유지를 위해 자동수집 팝업 / 사용자 게시판 (메이트 / 피드백) 은 포함하지 않는다.
 *
 * <p>등록 위치: https://searchadvisor.naver.com → 요청 → RSS 제출 →
 * {@code https://popspot.co.kr/feed.xml}
 *
 * <p>캐시 정책: ISR 1시간. 정적 페이지는 자주 안 바뀌므로 충분.
 */

const SITE_URL = "https://popspot.co.kr";
const SITE_TITLE = "POP-SPOT — 서울 팝업스토어 큐레이션";
const SITE_DESCRIPTION =
  "서울 팝업스토어를 지도와 위시 · 메이트 보드로 모아보는 큐레이션 서비스";

export const revalidate = 3600;

type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

export async function GET() {
  const now = new Date().toUTCString();

  const items: FeedItem[] = [
    {
      title: "POP-SPOT 서비스 소개",
      link: `${SITE_URL}/about`,
      description:
        "서울 팝업스토어 정보를 지도 한 화면에서 보는 무료 큐레이션 서비스. 위시 · 메이트 · D-3 알림.",
      pubDate: now,
    },
    {
      title: "POP-SPOT 시작하기",
      link: `${SITE_URL}/`,
      description: "서울 팝업을 지도 · 캘린더 · 랭킹 한 화면에서. 바로 둘러보세요.",
      pubDate: now,
    },
    {
      title: "이용 약관",
      link: `${SITE_URL}/terms`,
      description: "POP-SPOT 서비스 이용 약관. 자동수집 정책 (§10-2) 포함.",
      pubDate: now,
    },
    {
      title: "개인정보 처리방침",
      link: `${SITE_URL}/privacy`,
      description: "수집 항목 · 보관 기간 · DPO 연락처 등 개인정보 처리방침.",
      pubDate: now,
    },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>Next.js (popspot)</generator>
${items.map(renderItem).join("\n")}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function renderItem(item: FeedItem): string {
  return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${item.link}</guid>
    </item>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
