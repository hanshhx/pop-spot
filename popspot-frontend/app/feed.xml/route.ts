import { NextResponse } from 'next/server';

import { REGIONS, classifyRegion } from '@/lib/regions';
import {
  PERIODS,
  CATEGORIES,
  BRANDS,
  classifyCategory,
  matchesPeriod,
  isExpired,
  kstTodayStart,
  parseDate,
} from '@/lib/popupSlices';

/**
 * RSS 2.0 피드 (Naver SearchAdvisor / 일반 RSS 리더용).
 *
 * <p>v2.43 — 큐레이션 랜딩을 피드에 싣는다. 그 전까지는 운영자가 쓴 정적 페이지 4개(소개·시작하기·약관·
 * 개인정보)만 있었다. 네이버는 RSS 를 "이 사이트가 새 문서를 내놓는가" 판단에 쓰는데, 약관·개인정보만
 * 든 피드는 그 질문에 "아니오" 라고 답한다. 실제로 서치어드바이저 기준 색인 1건 / 90일 수집 10건 남짓
 * 이었다(sitemap 에는 120건을 냈는데도).
 *
 * <p>§10-2 (Naver/Kakao 검색 결과 재현 금지) 와의 관계: 예전 주석은 이 조항을 근거로 팝업을 통째로
 * 제외했다. 그러나 여기서 싣는 것은 <b>개별 팝업 문서가 아니라 우리가 만든 분류 페이지의 주소</b>이고,
 * description 도 수집한 문장이 아니라 <b>건수·마감 집계</b>다. sitemap.ts 가 같은 이유로 슬라이스 랜딩을
 * 이미 싣고 있다(그 파일 주석의 "개별 팝업 URL 목록은 검색 결과의 재현이 아니다" 와 같은 판단).
 * 수집 원문(팝업 이름·설명)은 계속 넣지 않는다.
 *
 * <p>등록 위치: https://searchadvisor.naver.com → 요청 → RSS 제출 → {@code /feed.xml}
 */

const SITE_URL = 'https://popspot.co.kr';
const SITE_TITLE = 'POP-SPOT — 서울 팝업스토어 큐레이션';
const SITE_DESCRIPTION = '서울 팝업스토어를 지도와 위시 · 메이트 보드로 모아보는 큐레이션 서비스';

/** 1시간. 슬라이스 건수는 팝업이 열리고 닫힐 때만 바뀌므로 더 자주 만들 이유가 없다. */
export const revalidate = 3600;

type Marker = {
  name: string;
  location: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
};

type FeedItem = {
  title: string;
  link: string;
  description: string;
  /** 정렬·출력에 쓰는 실제 시각. */
  date: Date;
};

/**
 * 진행 중인 마커.
 *
 * <p>URL·fetch 옵션을 sitemap.ts / app/popups/[slug]/page.tsx 와 <b>똑같이</b> 맞춘다. 같은 빌드 안에서
 * Next 데이터 캐시를 공유해 백엔드를 중복 호출하지 않고, 세 곳이 같은 스냅샷을 본다. 스냅샷이 어긋나면
 * "sitemap 에는 있는데 RSS 에는 없는" 불일치가 생긴다.
 *
 * <p>실패 시 빈 배열 → 아래에서 슬라이스가 전부 0건이 되어 정적 페이지만 나간다. 피드가 비는 것보다
 * 낫고, sitemap 의 실패 처리와도 같은 방향이다.
 */
async function liveMarkers(): Promise<Marker[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    console.error(
      `[feed] NEXT_PUBLIC_API_URL 이 없거나 형식이 잘못되었습니다(값: ${apiBase ?? '미설정'}). ` +
        `슬라이스 랜딩 없이 정적 페이지만 내보냅니다.`,
    );
    return [];
  }

  try {
    const res = await fetch(`${apiBase}/api/map/markers`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const markers = (await res.json()) as Marker[];
    const today = kstTodayStart();
    return markers.filter((m) => !isExpired(m.endDate, today));
  } catch (e) {
    console.error(
      `[feed] 마커 fetch 실패(${e instanceof Error ? e.message : String(e)}) — ` +
        `슬라이스 랜딩 없이 정적 페이지만 내보냅니다.`,
    );
    return [];
  }
}

/**
 * 슬라이스의 pubDate = 그 분류에 속한 팝업 중 <b>가장 최근 시작일</b>.
 *
 * <p>왜 지금 시각을 쓰지 않는가: 모든 항목을 매번 "방금 올라옴" 으로 내보내면 신선도 신호가 무의미해진다
 * (늘 전부 새 글이면 무엇이 새 글인지 알 수 없다). 그 페이지의 내용을 실제로 바꾼 사건은 "새 팝업이 그
 * 분류에 들어온 것" 이므로 그 날짜가 정직한 값이다.
 *
 * <p>예고(미래 시작일) 팝업은 <b>집계에서 먼저 뺀다.</b> 최댓값을 구한 뒤 오늘로 자르는 방식으로 짰다가
 * 전 항목이 같은 날짜가 되는 걸 확인했다 — 어느 분류에나 예고 팝업이 하나쯤 있어서 최댓값이 늘 미래가
 * 되고, 그걸 자르면 결국 전부 "지금" 이 된다. 즉 pubDate 를 now 로 두던 예전 코드와 같아진다.
 * 상한은 집계 뒤가 아니라 앞에 있어야 한다.
 *
 * <p>아직 아무도 열지 않은 분류(예: 내일 처음 여는 것만 있는 경우)는 fallback 을 쓴다.
 */
function latestStart(markers: Marker[], fallback: Date): Date {
  const ceiling = fallback.getTime();
  let best = 0;
  for (const m of markers) {
    const d = parseDate(m.startDate);
    if (!d) continue;
    const t = d.getTime();
    if (t <= ceiling && t > best) best = t;
  }
  return best ? new Date(best) : fallback;
}

/** 마감 임박(7일 이내) 건수 — description 에 쓰는 우리 집계값. */
function endingSoon(markers: Marker[], today: Date): number {
  const limit = today.getTime() + 7 * 86400000;
  return markers.filter((m) => {
    const end = parseDate(m.endDate);
    return end != null && end.getTime() <= limit;
  }).length;
}

/**
 * 슬라이스 하나를 피드 항목으로. 0건이면 null.
 *
 * <p>0건을 빼는 이유는 sitemap.ts 와 같다 — 내용 없는 페이지를 색인시키면 크롤 예산만 쓰고 사이트 품질
 * 평가에도 불리하다. 브랜드 랜딩은 0건일 때 페이지 자체가 noindex 이기도 하다.
 */
function sliceItem(
  slug: string,
  title: string,
  matched: Marker[],
  today: Date,
  now: Date,
  lead: string,
): FeedItem | null {
  if (matched.length === 0) return null;
  const soon = endingSoon(matched, today);
  const tail = soon > 0 ? ` 이 중 ${soon}곳은 7일 안에 끝난다.` : '';
  return {
    title,
    link: `${SITE_URL}/popups/${slug}`,
    description: `${lead} 현재 ${matched.length}곳.${tail} 지도 · 마감임박순으로 한 화면에서 볼 수 있다.`,
    date: latestStart(matched, now),
  };
}

export async function GET() {
  const now = new Date();
  const today = kstTodayStart();
  const live = await liveMarkers();

  // 지역·카테고리는 마커를 한 번만 훑어 버킷에 담는다(슬라이스 수 × 전체 마커 재순회를 피한다).
  const byRegion = new Map<string, Marker[]>();
  const byCategory = new Map<string, Marker[]>();
  for (const m of live) {
    const r = classifyRegion(m.location);
    const c = classifyCategory(m.category);
    let rb = byRegion.get(r);
    if (!rb) byRegion.set(r, (rb = []));
    rb.push(m);
    let cb = byCategory.get(c);
    if (!cb) byCategory.set(c, (cb = []));
    cb.push(m);
  }

  const items: FeedItem[] = [];

  // ① 시점 — 매일 내용이 바뀌므로 신선도 신호가 가장 크다. 네이버 검색어 상위가 "이번주 성수 팝업" 류다.
  for (const p of PERIODS) {
    const matched = live.filter((m) => matchesPeriod(m.startDate, m.endDate, p.code, now));
    const it = sliceItem(
      p.slug,
      `${p.label} 여는 서울 팝업스토어`,
      matched,
      today,
      now,
      `${p.label} 문을 여는 서울 팝업스토어를 모았다.`,
    );
    if (it) items.push(it);
  }

  // ② 지역
  for (const r of REGIONS) {
    const it = sliceItem(
      r.slug,
      `${r.label} 팝업스토어`,
      byRegion.get(r.code) ?? [],
      today,
      now,
      `${r.label} 일대에서 진행 중인 팝업스토어를 모았다.`,
    );
    if (it) items.push(it);
  }

  // ③ 카테고리
  for (const c of CATEGORIES) {
    const it = sliceItem(
      c.slug,
      `${c.label} 팝업스토어`,
      byCategory.get(c.code) ?? [],
      today,
      now,
      `서울에서 진행 중인 ${c.label} 팝업스토어를 모았다.`,
    );
    if (it) items.push(it);
  }

  // ④ 지역×시점 — 네이버 검색어 1위가 이 형태("이번주 성수 팝업")다. 매일 내용이 바뀌므로 피드에
  //    싣는 값도 크다. 0곳 조합은 sliceItem 이 걸러낸다.
  for (const r of REGIONS) {
    const inRegion = byRegion.get(r.code) ?? [];
    if (inRegion.length === 0) continue;
    for (const p of PERIODS) {
      const matched = inRegion.filter((m) => matchesPeriod(m.startDate, m.endDate, p.code, now));
      const it = sliceItem(
        `${r.slug}-${p.slug}`,
        `${p.label} ${r.label} 팝업스토어`,
        matched,
        today,
        now,
        `${p.label} ${r.label}에서 문 여는 팝업스토어를 모았다.`,
      );
      if (it) items.push(it);
    }
  }

  // ⑤ 브랜드·IP — 새 IP 팝업이 열리는 것이 이 사이트에서 실제로 "새 소식" 에 가장 가깝다.
  //    매칭은 sitemap.ts / page.tsx 와 같은 방식(이름+위치 소문자 substring).
  for (const b of BRANDS) {
    const kws = b.keywords.map((k) => k.toLowerCase());
    const matched = live.filter((m) => {
      const hay = `${m.name ?? ''} ${m.location ?? ''}`.toLowerCase();
      return kws.some((k) => hay.includes(k));
    });
    const it = sliceItem(
      b.slug,
      `${b.label} 팝업스토어`,
      matched,
      today,
      now,
      `${b.label} 관련 팝업스토어를 모았다.`,
    );
    if (it) items.push(it);
  }

  // 최신순. RSS 리더와 검색엔진 모두 앞쪽을 중요하게 본다.
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  // 최신 N 개로 자른다.
  //
  // 슬라이스를 전부 실으면 128건 / 60KB 가 나오는데, 네이버 RSS 제출 화면이 "본문 크기에 따라 제출에
  // 제한될 수 있으니 중요한 콘텐츠만 포함시켜 주세요" 라고 안내한다. 정확한 상한은 공개돼 있지 않아
  // 넘겼을 때 무슨 일이 생기는지 알 수 없고, 거부되면 피드 전체를 잃는다.
  //
  // 자르는 쪽이 안전한 이유는 sitemap 과 역할이 다르기 때문이다 — 색인 대상 전체 목록은 sitemap 이
  // 이미 167건 전부 싣고 있고(§sitemap.ts), RSS 가 맡은 일은 "최근에 뭐가 바뀌었나" 신호다. 최신순으로
  // 정렬한 뒤 자르므로 그 역할은 그대로 유지된다.
  const MAX_SLICE_ITEMS = 60;
  items.length = Math.min(items.length, MAX_SLICE_ITEMS);

  // 운영자가 쓴 정적 페이지는 뒤에 붙인다 — 자주 바뀌지 않으므로 신선도 경쟁에서 앞자리를 차지할 이유가 없다.
  items.push(
    {
      title: 'POP-SPOT 서비스 소개',
      link: `${SITE_URL}/about`,
      description:
        '서울 팝업스토어 정보를 지도 한 화면에서 보는 무료 큐레이션 서비스. 지역 · 브랜드 · 마감임박순.',
      date: now,
    },
    {
      title: '이용 약관',
      link: `${SITE_URL}/terms`,
      description: 'POP-SPOT 서비스 이용 약관. 자동수집 정책 (§10-2) 포함.',
      date: now,
    },
    {
      title: '개인정보 처리방침',
      link: `${SITE_URL}/privacy`,
      description: '수집 항목 · 보관 기간 · DPO 연락처 등 개인정보 처리방침.',
      date: now,
    },
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <generator>Next.js (popspot)</generator>
${items.map(renderItem).join('\n')}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function renderItem(item: FeedItem): string {
  return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.date.toUTCString()}</pubDate>
      <guid isPermaLink="true">${item.link}</guid>
    </item>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
