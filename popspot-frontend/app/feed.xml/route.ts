import { NextResponse } from 'next/server';

import { REGIONS, classifyRegion } from '@/lib/regions';
import { loadPublicMarkers } from '@/lib/emergencyPopupData';
import {
  getPeriods,
  CATEGORIES,
  BRANDS,
  classifyCategory,
  matchesPeriod,
  isExpired,
  isStale,
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
const ABOUT_PUBLISHED_AT = new Date('2026-05-27T01:26:12Z');

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
 * <p>실패 시 sitemap 과 같은 검증된 공개 스냅샷을 써서 피드가 정적 항목 1건으로 무너지지 않게 한다.
 */
async function liveMarkers(): Promise<Marker[]> {
  const { markers, source, capturedAt } = await loadPublicMarkers(3600);
  if (source === 'snapshot') {
    console.warn(`[feed] 비상 스냅샷 사용(마지막 확인 ${capturedAt}, ${markers.length}건)`);
  }
  const today = kstTodayStart();
  return markers.filter(
    (m) => !isExpired(m.endDate, today) && !isStale(m.startDate, m.endDate, today),
  );
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
  for (const p of getPeriods(now)) {
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
    for (const p of getPeriods(now)) {
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

  // 동적 목록을 가져오지 못해도 RSS 자체가 빈 문서가 되지 않도록 서비스 소개 한 건은 남긴다.
  // 이용약관·개인정보처리방침까지 매 요청 시각으로 넣던 이전 구현은 세 문서를 매시간 새 글로
  // 위장했다. 실제 공개일을 가진 소개만 두고, 정책 문서는 sitemap 에서 찾게 한다.
  items.push({
    title: 'POP-SPOT 서비스 소개',
    link: `${SITE_URL}/about`,
    description:
      '서울 팝업스토어 정보를 지도 한 화면에서 보는 무료 큐레이션 서비스. 지역 · 브랜드 · 마감임박순.',
    date: ABOUT_PUBLISHED_AT,
  });

  // 최신순. RSS 리더와 검색엔진 모두 앞쪽을 중요하게 본다.
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  /*
   * 건수가 아니라 크기로 자른다.
   *
   * 예전에는 60건으로 잘랐다. 네이버 RSS 제출 화면이 "본문 크기에 따라 제출에 제한될 수 있으니
   * 중요한 콘텐츠만 포함시켜 주세요" 라고 안내하는데, 정확한 상한이 공개돼 있지 않아 거부되면
   * 피드 전체를 잃을까 봐 보수적으로 잡은 값이었다.
   *
   * 그 값이 지금 병목이다. 2026-08-12 서치어드바이저 기준 네이버 색인이 43건인데 RSS 가 60건이다.
   * 사이트맵에는 분류 랜딩만 173건을 내고 있는데도 색인이 피드 크기에 붙어 있다 — 네이버가 보는
   * 재고가 사실상 이 피드라는 뜻이다.
   *
   * 그래서 걱정하던 것(크기)을 직접 재기로 한다. 건수로 자르면 항목이 짧든 길든 같은 수에서 멈춰
   * 여유가 있어도 못 싣는다. 바이트로 재면 안전한 만큼 최대한 싣는다.
   *
   * 200KB 는 네이버가 공개한 값이 아니라 우리가 정한 보수적인 상한이다. 지금 전체를 실어도
   * 60KB 남짓이라 한참 아래이고, 팝업이 늘어 항목이 불어나도 이 선에서 멈춘다.
   *
   * 싣는 것은 여전히 <b>우리가 만든 분류 페이지</b>뿐이다. 수집 원문(팝업 이름·설명)은 넣지
   * 않는다 — §10-2 관련 판단은 이 파일 상단 주석 그대로다.
   */
  const fitted = fitWithinBudget(items, MAX_FEED_BYTES);
  items.length = 0;
  items.push(...fitted);
  const lastBuildDate = items.reduce(
    (latest, item) => (item.date.getTime() > latest.getTime() ? item.date : latest),
    ABOUT_PUBLISHED_AT,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
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

/**
 * 네이버 RSS 제출에 넣을 <b>본문 크기 상한</b>.
 *
 * <p>네이버가 공개한 값이 아니라 우리가 정한 보수적인 선이다. 제출 화면은 "본문 크기에 따라 제출에
 * 제한될 수 있다" 고만 안내한다. 지금 슬라이스를 전부 실어도 60KB 남짓이라 한참 아래이고, 팝업이
 * 늘어 항목이 불어나도 여기서 멈춘다.
 */
export const MAX_FEED_BYTES = 200_000;

/**
 * 크기 예산 안에 들어가는 만큼만 남긴다.
 *
 * <p>예전에는 60건으로 <b>건수</b>를 잘랐다. 그러면 항목이 짧든 길든 같은 수에서 멈춰, 여유가 있어도
 * 못 싣는다. 걱정하던 것은 크기였으니 크기를 직접 재는 편이 맞다.
 *
 * <p>이 값이 곧 네이버가 보는 재고다 — 2026-08-12 기준 색인 43건에 피드 60건이었다. 사이트맵에 분류
 * 랜딩만 173건을 내고 있는데도 색인이 피드 크기에 붙어 있었다.
 *
 * <p><b>순서를 지킨다.</b> 호출자가 최신순으로 정렬해 넘기므로, 앞에서부터 채우면 잘리는 것은 늘 가장
 * 오래된 항목이다. RSS 가 맡은 "최근에 뭐가 바뀌었나" 신호가 유지된다.
 */
export function fitWithinBudget<T>(
  items: T[],
  maxBytes: number,
  render: (item: T) => string = (item) => renderItem(item as FeedItem),
): T[] {
  const encoder = new TextEncoder();
  const fitted: T[] = [];
  let used = 0;
  for (const item of items) {
    used += encoder.encode(render(item)).length;
    if (used > maxBytes) break;
    fitted.push(item);
  }
  return fitted;
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
