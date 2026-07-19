import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, Tag, Clock, Flame } from "lucide-react";

import { REGIONS, classifyRegion, regionBySlug } from "@/lib/regions";
import { CRAWL_REFRESH_COPY } from "@/lib/siteCopy";
import {
  PERIODS,
  CATEGORIES,
  BRANDS,
  matchesPeriod,
  classifyCategory,
  periodBySlug,
  categoryBySlug,
  brandBySlug,
  parseDate,
  startOfDay,
} from "@/lib/popupSlices";

/**
 * v2.21-S3 / v2.33 — Long-tail SEO 랜딩 페이지 (전환 강화 리디자인).
 *
 * <p>슬러그 형식: 지역(/popups/seongsu) · 시점(/popups/today) · 카테고리(/popups/fashion) ·
 *    브랜드/IP(/popups/pokemon) · 지역×카테고리(/popups/seongsu-fashion).
 *
 * <p>각 페이지가 독립 URL + 키워드 풍부한 title/description/H1/H2/본문 → Naver/Google
 * long-tail 검색 진입 미끼. 검색 유입자를 "혹하게" 만들어 메인 지도로 유도하는 것이 목표.
 *
 * <p>전환 설계(디자인 패널 종합): (1) 이미 노출 중인 endDate 를 D-day 로 재포맷해 마감 긴박감을
 * 최상단으로 — 긴급 스트립 + 마감임박순 정렬 + D-day 배지. (2) '무료·로그인 없이' 마찰 제거 +
 * 편익 예고. (3) 하단 링크 클라우드를 '지금 찾는 팝업' 회유 동선으로 승격.
 *
 * <p>약관 §10-2: 자동수집 팝업 '상세'는 노출 X. 카운트 + 최소목록(이름·위치·기간·D-day) + 메인
 * 지도 링크만. D-day 는 새 정보가 아니라 기존 endDate 의 재포맷이라 허용.
 *
 * <p>SSG(generateStaticParams) + ISR(revalidate=3600). 실시간 데이터는 메인 지도로 유도.
 */

const SITE_URL = "https://popspot.co.kr";
// 갱신 주기 카피는 홈 SEO 블록과도 공유한다(한 곳만 고치면 전부 반영). @see src/lib/siteCopy.ts
const REFRESH_COPY = CRAWL_REFRESH_COPY;

type Marker = {
  id: number;
  name: string;
  location: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
};

type Slice =
  | { kind: "region"; slug: string; label: string }
  | { kind: "period"; slug: string; label: string }
  | { kind: "category"; slug: string; label: string }
  | { kind: "brand"; slug: string; label: string; keywords: string[] }
  | {
      kind: "region-category";
      slug: string;
      label: string;
      regionSlug: string;
      categorySlug: string;
    };

// v2.21-S3 — ISR + 알 수 없는 슬러그는 404.
// Next.js 16 segment config 는 literal 값만 받음 (const 변수 참조 X).
export const revalidate = 3600;
export const dynamicParams = false;

/** 모든 슬러그를 빌드 타임에 미리 생성. 신규 슬라이스 추가 시 빌드 한 번 더 돌리면 됨. */
export function generateStaticParams() {
  return [
    ...REGIONS.map((r) => ({ slug: r.slug })),
    ...PERIODS.map((p) => ({ slug: p.slug })),
    ...CATEGORIES.map((c) => ({ slug: c.slug })),
    ...BRANDS.map((b) => ({ slug: b.slug })),
    ...REGIONS.flatMap((r) => CATEGORIES.map((c) => ({ slug: `${r.slug}-${c.slug}` }))),
  ];
}

function resolveSlice(slug: string): Slice | null {
  const r = regionBySlug(slug);
  if (r) return { kind: "region", slug: r.slug, label: r.label };
  const p = periodBySlug(slug);
  if (p) return { kind: "period", slug: p.slug, label: p.label };
  const c = categoryBySlug(slug);
  if (c) return { kind: "category", slug: c.slug, label: c.label };
  const b = brandBySlug(slug);
  if (b) return { kind: "brand", slug: b.slug, label: b.label, keywords: b.keywords };
  for (const reg of REGIONS) {
    if (!slug.startsWith(`${reg.slug}-`)) continue;
    const cat = categoryBySlug(slug.slice(reg.slug.length + 1));
    if (cat) {
      return {
        kind: "region-category",
        slug,
        label: `${reg.label} ${cat.label}`,
        regionSlug: reg.slug,
        categorySlug: cat.slug,
      };
    }
  }
  return null;
}

/** 슬라이스 → 메인 지도 deep link 쿼리스트링. */
function deepLinkQuery(slice: Slice): string {
  switch (slice.kind) {
    case "region":
      return `region=${slice.slug}`;
    case "period":
      return `period=${slice.slug}`;
    case "category":
      return `category=${slice.slug}`;
    case "brand":
      // 지도엔 브랜드 필터 파라미터가 없어 전체 지도로 유도(랜딩 목록이 SEO 본체).
      return "";
    case "region-category":
      return `region=${slice.regionSlug}&category=${slice.categorySlug}`;
  }
}

/** 백엔드 visible markers — SSG 빌드 타임에 fetch. */
async function fetchMarkers(): Promise<Marker[]> {
  // NEXT_PUBLIC_API_BASE_URL 은 저장소 어디에도 정의가 없는 폐기된 오타 이름이었다(실제는 _API_URL).
  // 그동안 항상 SITE_URL 로 폴백해 자기 공개 도메인 → 리라이트를 헤어핀으로 되돌아 타고 있었다.
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? SITE_URL;
  try {
    const res = await fetch(`${apiBase}/api/map/markers`, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn(`[popups/slug] 마커 fetch ${res.status} — 빈 목록으로 렌더합니다.`);
      return [];
    }
    return (await res.json()) as Marker[];
  } catch (e) {
    // 조용히 삼키면 SEO 랜딩 전체가 "0곳" 상태로 빌드되어도 아무도 모른다.
    console.warn("[popups/slug] 마커 fetch 실패 — 빈 목록으로 렌더합니다.", e);
    return [];
  }
}

function filterBySlice(markers: Marker[], slice: Slice): Marker[] {
  switch (slice.kind) {
    case "region":
      return markers.filter((m) => classifyRegion(m.location) === slice.slug);
    case "period":
      return markers.filter((m) => matchesPeriod(m.startDate, m.endDate, slice.slug as never));
    case "category":
      return markers.filter((m) => classifyCategory(m.category) === slice.slug);
    case "brand": {
      const kws = slice.keywords.map((k) => k.toLowerCase());
      return markers.filter((m) => {
        const hay = `${m.name ?? ""} ${m.location ?? ""}`.toLowerCase();
        return kws.some((k) => hay.includes(k));
      });
    }
    case "region-category":
      return markers.filter(
        (m) =>
          classifyRegion(m.location) === slice.regionSlug &&
          classifyCategory(m.category) === slice.categorySlug,
      );
  }
}

/* ===== D-day 유틸 (기존 endDate 재포맷 — 새 정보 아님, §10-2 준수) ===== */

/** KST(UTC+9) 기준 오늘 00:00. 서버 TZ(Vercel=UTC)와 무관하게 KST 달력 날짜를 쓴다. */
function kstTodayStart(): Date {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
}

/** endDate 까지 남은 일수. 0=오늘 마감, 1=내일, 음수=이미 종료, null=종료일 없음. */
function ddayOf(endDate: string | null, today: Date): number | null {
  const end = parseDate(endDate);
  if (!end) return null;
  return Math.round((startOfDay(end).getTime() - today.getTime()) / 86400000);
}

/** D-day → 배지(문구·색). 상시(null)·종료(음수)는 무배지. */
function ddayBadge(dday: number | null): { text: string; cls: string } | null {
  if (dday === null || dday < 0) return null;
  if (dday === 0) return { text: "오늘 마감", cls: "bg-red-500 text-white" };
  if (dday === 1) return { text: "내일 마감", cls: "bg-red-500 text-white" };
  if (dday <= 3) return { text: `D-${dday}`, cls: "bg-orange-500 text-white" };
  if (dday <= 7) return { text: `D-${dday}`, cls: "bg-amber-400 text-ink-900" };
  return { text: "진행 중", cls: "bg-lime-300 text-ink-900" };
}

/** 매칭 팝업들이 몰린 상위 지역 slug (브랜드 랜딩 크로스셀용 — 지도에서 바로 좁히게). */
function topRegionSlugs(markers: Marker[], n: number): string[] {
  const counts: Record<string, number> = {};
  for (const m of markers) {
    const r = classifyRegion(m.location);
    if (r) counts[r] = (counts[r] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([slug]) => slug);
}

/* ============================== 메타 ============================== */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const slice = resolveSlice(slug);
  if (!slice) return { title: "찾을 수 없음", robots: { index: false } };

  const titles: Record<Slice["kind"], string> = {
    region: `${slice.label} 팝업스토어 추천`,
    period: `${slice.label} 진행 팝업스토어`,
    category: `${slice.label} 팝업스토어`,
    brand: `${slice.label} 팝업스토어 일정·위치`,
    "region-category": `${slice.label} 팝업스토어 추천`,
  };
  const descriptions: Record<Slice["kind"], string> = {
    region: `${slice.label}에서 진행 중인 팝업스토어 일정과 위치를 한눈에. 위시 등록, 마감 D-3 알림, 같이 갈 동행 매칭까지 무료.`,
    period: `${slice.label} 서울에서 열리는 팝업스토어 목록. 영업 시간, 위치, 종료일까지 정리.`,
    category: `${slice.label} 관련 팝업스토어 모음. 신상 / 인기 / 마감 임박 한눈에 보기.`,
    brand: `${slice.label} 팝업스토어 일정과 위치를 지도로 한눈에. 서울에서 진행 중인 ${slice.label} 팝업을 확인하고 위시·마감 D-3 알림까지 무료.`,
    "region-category": `${slice.label} 팝업스토어를 한눈에. 위치·일정·카테고리별 큐레이션, 위시 등록과 마감 D-3 알림까지 무료.`,
  };

  const title = titles[slice.kind];
  const description = descriptions[slice.kind];
  const url = `${SITE_URL}/popups/${slice.slug}`;

  // 결과 0곳이면 thin content 방지 위해 noindex (페이지 접근·내부링크는 유지).
  let robots: Metadata["robots"] | undefined;
  if (slice.kind === "region-category" || slice.kind === "brand") {
    const count = filterBySlice(await fetchMarkers(), slice).length;
    if (count === 0) robots = { index: false, follow: true };
  }

  return {
    title,
    description,
    robots,
    alternates: { canonical: url },
    openGraph: { title: `${title} · POP-SPOT`, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* ============================== 페이지 ============================== */

export default async function PopupsBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slice = resolveSlice(slug);
  if (!slice) notFound();

  const markers = await fetchMarkers();
  const filtered = filterBySlice(markers, slice);
  const count = filtered.length;
  const deepLink = deepLinkQuery(slice);
  const mapHref = `/?tab=MAP${deepLink ? `&${deepLink}` : ""}`;
  const mainHref = `${SITE_URL}${mapHref}`;

  // "지금 가야 할 이유" 훅 — 전부 기존 endDate/startDate 의 파생값(무료).
  const todayStart = kstTodayStart();
  const soonThreshold = new Date(todayStart);
  soonThreshold.setDate(soonThreshold.getDate() + 7);
  const closingSoon = filtered.filter((m) => {
    const end = parseDate(m.endDate);
    return end !== null && startOfDay(end) >= todayStart && startOfDay(end) <= soonThreshold;
  }).length;
  const openingToday = filtered.filter((m) => {
    const start = parseDate(m.startDate);
    return start !== null && startOfDay(start).getTime() === todayStart.getTime();
  }).length;

  // 마감임박순 정렬 + 각 항목 D-day. 종료일 없음/이미 종료는 뒤로.
  // 정렬 기준을 rank() 한 곳에만 두어, 목록 순서와 히어로의 '가장 빠른 마감' 이 어긋날 수 없게 한다.
  const rank = (d: number | null) => (d === null || d < 0 ? Infinity : d);
  const sorted = filtered
    .map((m) => ({ m, dday: ddayOf(m.endDate, todayStart) }))
    .sort((a, b) => rank(a.dday) - rank(b.dday));
  // 정렬했으므로 맨 앞이 곧 최소값. (Infinity = 유효한 마감일이 하나도 없음)
  const soonest = sorted.length > 0 ? rank(sorted[0].dday) : Infinity;
  const minDday = Number.isFinite(soonest) ? soonest : null;

  const headingByKind: Record<Slice["kind"], string> = {
    region: `${slice.label} 팝업스토어 ${count}곳`,
    period: `${slice.label} 진행 중인 팝업 ${count}곳`,
    category: `${slice.label} 팝업스토어 ${count}곳`,
    brand: `${slice.label} 팝업스토어 ${count}곳`,
    "region-category": `${slice.label} 팝업스토어 ${count}곳`,
  };
  const introByKind: Record<Slice["kind"], string> = {
    region: `${slice.label}에서 진행 중인 팝업스토어를 POP-SPOT 이 자동 큐레이션 합니다. 영업 기간이 끝난 팝업은 자동으로 빠지고, 신규 팝업은 ${REFRESH_COPY}에 갱신.`,
    period: `${slice.label} 서울 곳곳에서 열리는 팝업스토어. 위치 · 카테고리 · 마감일을 지도 한 화면에서 확인.`,
    category: `${slice.label} 관련 신상 / 인기 팝업스토어. 위시 등록 시 마감 3일 전 알림 발송.`,
    brand: `${slice.label} 관련 팝업스토어를 POP-SPOT 이 자동 큐레이션. 서울에서 진행 중인 ${slice.label} 팝업의 위치·일정을 한눈에. 위시 등록 시 마감 3일 전 알림 발송.`,
    "region-category": `${slice.label} 팝업스토어를 POP-SPOT 이 자동 큐레이션. 해당 지역·카테고리에 맞는 팝업만 모아 위치와 일정을 한눈에.`,
  };

  // subcopy — 마감 임박이 있으면 손실회피 훅, 없으면 편익.
  const subcopy =
    minDday !== null
      ? `가장 빨리 끝나는 곳은 D-${minDday}. 위치·영업기간·마감일을 로그인 없이 무료로, 지금 지도에서 확인하세요.`
      : `${slice.label} 팝업 위치·영업기간·마감일을 지도 한 화면에서. 로그인 없이 무료로 지금 바로.`;

  // Record 로 둬야 슬라이스 종류가 늘 때 헤딩·소개문과 함께 타입 검사에 걸린다(삼항은 조용히 통과).
  const kickerByKind: Record<Slice["kind"], string> = {
    region: "REGION",
    period: "WHEN",
    category: "CATEGORY",
    brand: "BRAND",
    "region-category": "REGION × CATEGORY",
  };
  const kicker = kickerByKind[slice.kind];

  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft size={14} /> 메인으로
        </Link>

        {/* 배지 — 진행 중이면 라임 펄스 점 + 카운트로 '살아있는' 신호 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
          <SliceIcon kind={slice.kind} />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground">
            {kicker}
          </span>
          {count > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-lime-600 dark:text-lime-300">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime-400 motion-safe:animate-pulse" />
              지금 진행 중 {count}곳
              {closingSoon > 0 && (
                <span className="text-orange-500"> · 마감 임박 {closingSoon}곳</span>
              )}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-5xl font-black mb-3 leading-tight">
          {headingByKind[slice.kind]}
        </h1>

        <p className="text-sm md:text-base text-gray-600 dark:text-white/70 max-w-2xl mb-6">
          {count > 0 ? subcopy : introByKind[slice.kind]}
        </p>

        {count > 0 && (
          <>
            {/* 긴급 스트립 — 가장 빠른 마감을 가장 크게 (핵심 전환 레버) */}
            <div className="mb-5 flex gap-2 md:gap-3">
              <StatCard label="진행 중" value={`${count}곳`} />
              {minDday !== null && (
                <StatCard
                  label="가장 빠른 마감"
                  value={minDday === 0 ? "오늘" : `D-${minDday}`}
                  big
                  tone={minDday <= 3 ? "hot" : "lime"}
                />
              )}
              {openingToday > 0 && <StatCard label="오늘 오픈" value={`${openingToday}곳`} />}
            </div>

            {/* 라임 CTA 박스 — 편익 CTA + 마찰 제거 + 편익 예고 */}
            <section className="mb-8 rounded-2xl border border-lime-300/50 bg-lime-50 p-5 dark:bg-lime-300/[0.06] md:p-6">
              <Link
                href={mapHref}
                className="block w-full rounded-2xl bg-lime-300 px-6 py-4 text-center text-base font-black text-ink-900 shadow-lg transition hover:bg-lime-400 md:text-lg"
              >
                지도에서 {slice.label} 팝업 위치·마감일 보기 →
              </Link>
              <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
                무료 · 로그인 없이 · {REFRESH_COPY} 자동 갱신
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {["지도 한눈에", "마감 D-3 알림", "같이 갈 동행 매칭"].map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center rounded-pill border border-lime-300/50 bg-white/60 px-2.5 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-white/5 dark:text-white/70"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </section>

            {/* 목록 — 마감임박순 + D-day 배지 (기존 기간 재포맷) */}
            <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-lg shadow-black/5 dark:shadow-black/30 p-6 md:p-8 mb-6">
              <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-orange-500" /> 마감 임박순 팝업
              </h2>
              <ul className="space-y-3">
                {sorted.slice(0, 30).map(({ m, dday }) => {
                  const badge = ddayBadge(dday);
                  return (
                    <li
                      key={m.id}
                      className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-white/5 last:border-0"
                    >
                      <span className="text-lime-500 mt-1">
                        <MapPin size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm md:text-base font-bold truncate">{m.name}</h3>
                          {badge && (
                            <span
                              className={`shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-black ${badge.cls}`}
                            >
                              {badge.text}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.location ?? "위치 정보 없음"}
                        </p>
                        {(m.startDate || m.endDate) && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {m.startDate ?? "?"} ~ {m.endDate ?? "?"}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > 30 && (
                <p className="text-xs text-muted-foreground mt-3">
                  외 {filtered.length - 30}곳 더 — 메인 지도에서 전체 확인
                </p>
              )}
            </section>

            <Link
              href={mapHref}
              className="block w-full text-center px-6 py-4 rounded-2xl bg-lime-300 text-ink-900 font-black text-base md:text-lg hover:bg-lime-400 transition shadow-lg"
            >
              지도에서 {slice.label} 팝업 보기 →
            </Link>
          </>
        )}

        {count === 0 && (
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-bold mb-2">
              {slice.label} 팝업은 지금 잠시 쉬어가는 중이에요
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              서울 전체는 지금도 열려 있어요. 새 팝업은 {REFRESH_COPY}에 자동 수집됩니다 — 지금 진행 중인 팝업부터 지도에서 둘러보세요.
            </p>
            <Link
              href="/?tab=MAP"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-pill bg-lime-300 text-ink-900 font-bold text-sm hover:bg-lime-400 transition"
            >
              지금 열린 팝업 지도에서 보기 →
            </Link>
            <p className="mt-3 text-[11px] text-muted-foreground">
              무료 · 로그인 없이 · 메인에서 위시 등록 시 새 {slice.label} 팝업 열릴 때 알림
            </p>
          </section>
        )}

        <CrossSell current={slice} filtered={filtered} openingToday={openingToday} closingSoon={closingSoon} />

        <FaqSection slice={slice} count={count} />
      </div>

      {/* JSON-LD ItemList — 검색결과 풍부도 ↑ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: headingByKind[slice.kind],
            description: introByKind[slice.kind],
            url: mainHref,
            numberOfItems: count,
          }),
        }}
      />
    </main>
  );
}

/* ============================== 보조 컴포넌트 ============================== */

function StatCard({
  label,
  value,
  big = false,
  tone = "neutral",
}: {
  label: string;
  value: string;
  big?: boolean;
  tone?: "neutral" | "lime" | "hot";
}) {
  const valueColor =
    tone === "hot"
      ? "text-orange-500"
      : tone === "lime"
        ? "text-lime-600 dark:text-lime-300"
        : "text-foreground";
  return (
    <div
      className={`flex-1 rounded-2xl border p-3 md:p-4 text-center ${
        big
          ? "border-lime-300/60 bg-lime-50 dark:bg-lime-300/[0.06]"
          : "border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`font-black leading-tight ${big ? "text-2xl md:text-3xl" : "text-lg md:text-xl"} ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}

function SliceIcon({ kind }: { kind: Slice["kind"] }) {
  const cls = "text-lime-500";
  if (kind === "region") return <MapPin size={16} className={cls} />;
  if (kind === "period") return <Calendar size={16} className={cls} />;
  return <Tag size={16} className={cls} />;
}

/**
 * 회유 동선 — 밋밋한 태그 클라우드를 '지금 찾는 팝업'으로 승격.
 * (1) 고의도 칩(오늘 오픈 / 주말 마감임박) (2) 브랜드 랜딩이면 매칭 팝업의 상위 지역 칩
 * (3) 브랜드/IP 우선 + 지역·시점·카테고리 전체 링크(SEO 내부링크 밀도 유지).
 */
function CrossSell({
  current,
  filtered,
  openingToday,
  closingSoon,
}: {
  current: Slice;
  filtered: Marker[];
  openingToday: number;
  closingSoon: number;
}) {
  // 고의도 칩
  const intent: { href: string; label: string; icon: "flame" | "clock" }[] = [];
  // 자기 자신으로 가는 순환 링크만 빼고 항상 노출한다.
  // (이전엔 `openingToday > 0 ||` 가 앞에 붙어 있었는데, today 가 아닌 페이지에선 뒤 절이 이미 참이라
  //  카운트 절이 아무것도 결정하지 못했고, 정작 /popups/today 에선 자기 자신을 가리키는 칩이 떴다.)
  if (current.slug !== "today")
    intent.push({ href: "/popups/today", label: "오늘 오픈 팝업", icon: "flame" });
  if (current.slug !== "this-weekend")
    intent.push({ href: "/popups/this-weekend", label: "이번 주말 마감 임박", icon: "clock" });

  // 브랜드 랜딩은 지도 필터가 없어 → 매칭 팝업 상위 지역으로 좁히게 유도
  const regionChips =
    current.kind === "brand"
      ? topRegionSlugs(filtered, 3)
          .map((s) => regionBySlug(s))
          .filter((r): r is NonNullable<typeof r> => !!r)
      : [];

  // 전체 링크(SEO) — 브랜드/IP 먼저
  const links: { slug: string; label: string; kind: Slice["kind"] }[] = [
    ...BRANDS.map((b) => ({ slug: b.slug, label: b.label, kind: "brand" as const })),
    ...REGIONS.map((r) => ({ slug: r.slug, label: r.label, kind: "region" as const })),
    ...PERIODS.map((p) => ({ slug: p.slug, label: p.label, kind: "period" as const })),
    ...CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, kind: "category" as const })),
  ].filter((s) => s.slug !== current.slug);

  return (
    <nav
      aria-label="다른 팝업 둘러보기"
      className="mt-10 pt-6 border-t border-gray-200 dark:border-white/10"
    >
      <h3 className="text-sm md:text-base font-bold mb-3">이런 팝업도 지금 찾고 있나요?</h3>

      {(intent.length > 0 || regionChips.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {intent.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="inline-flex items-center gap-1.5 rounded-pill border border-lime-300/60 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-700 transition hover:bg-lime-100 dark:bg-lime-300/10 dark:text-lime-300 dark:hover:bg-lime-300/20"
            >
              {c.icon === "flame" ? <Flame size={13} /> : <Clock size={13} />}
              {c.label}
            </Link>
          ))}
          {regionChips.map((r) => (
            <Link
              key={r.slug}
              href={`/popups/${r.slug}`}
              className="inline-flex items-center gap-1.5 rounded-pill border border-lime-300/60 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-700 transition hover:bg-lime-100 dark:bg-lime-300/10 dark:text-lime-300 dark:hover:bg-lime-300/20"
            >
              <MapPin size={13} />
              {r.label} {current.label} 팝업
            </Link>
          ))}
        </div>
      )}

      <ul className="flex flex-wrap gap-2">
        {links.map((s) => (
          <li key={`${s.kind}-${s.slug}`}>
            <Link
              href={`/popups/${s.slug}`}
              className="inline-flex items-center px-3 py-1.5 rounded-pill text-xs font-medium border bg-white text-gray-900 border-gray-200 hover:border-lime-300 hover:bg-lime-50 dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-lime-300/10 dark:hover:border-lime-300/40 transition"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FaqSection({ slice, count }: { slice: Slice; count: number }) {
  const faqs = [
    {
      q: "팝업 정보는 얼마나 자주 갱신되나요?",
      a: `${REFRESH_COPY}에 자동 수집합니다. 신규 팝업이 등록되면 BROWSE 와 지도에 즉시 반영됩니다.`,
    },
    {
      q: `${slice.label} 슬라이스는 어떻게 분류되나요?`,
      a:
        slice.kind === "region"
          ? "팝업 주소의 동/로 이름을 기준으로 분류합니다. 정확한 위치는 지도에서 확인하세요."
          : slice.kind === "period"
            ? "팝업의 운영 시작일·종료일을 기준으로 해당 기간 안에 한 번이라도 열리면 포함됩니다."
            : slice.kind === "brand"
              ? "팝업 이름에 해당 브랜드/IP 이름이 포함되면 자동으로 모읍니다. 진행 중인 팝업만 표시됩니다."
              : "팝업 카테고리 필드의 한글/영문 키워드를 매칭해 분류합니다.",
    },
    {
      q: "위시 등록 / 마감 알림은 어디서 하나요?",
      a: `메인 지도의 팝업 마커를 누른 뒤 상세 페이지에서 위시 등록할 수 있습니다. 현재 ${count}곳 진행 중.`,
    },
  ];

  return (
    <section className="mt-10 pt-6 border-t border-gray-200 dark:border-white/10">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        자주 묻는 질문
      </h3>
      <ul className="space-y-4">
        {faqs.map((f, i) => (
          <li key={i}>
            <p className="text-sm md:text-base font-bold mb-1">{f.q}</p>
            <p className="text-xs md:text-sm text-muted-foreground">{f.a}</p>
          </li>
        ))}
      </ul>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </section>
  );
}
