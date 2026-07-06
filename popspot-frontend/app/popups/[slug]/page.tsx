import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, Tag } from "lucide-react";

import { REGIONS, classifyRegion, regionBySlug } from "@/lib/regions";
import {
  PERIODS,
  CATEGORIES,
  matchesPeriod,
  classifyCategory,
  periodBySlug,
  categoryBySlug,
} from "@/lib/popupSlices";

/**
 * v2.21-S3 — Long-tail SEO 랜딩 페이지.
 *
 * <p>슬러그 형식:
 *
 * <ul>
 *   <li>지역: {@code /popups/seongsu}, {@code /popups/hannam}, ...
 *   <li>시점: {@code /popups/today}, {@code /popups/this-weekend}, ...
 *   <li>카테고리: {@code /popups/fashion}, {@code /popups/beauty}, ...
 * </ul>
 *
 * <p>각 페이지가 독립 URL + 키워드 풍부한 title/description/H1/H2/본문 → Naver/Google
 * long-tail 검색 (예: "성수동 팝업스토어 추천") 진입 미끼.
 *
 * <p>SSG (force-static) 로 빌드 타임에 미리 생성. 실시간 데이터는 메인 지도 ({@code /?region=...})
 * 로 유도. 약관 §10-2 일관성 — 자동수집 팝업 상세는 노출 X, 카운트 + 메인 지도 진입 링크만.
 */

const SITE_URL = "https://popspot.co.kr";

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
  | {
      kind: "region-category";
      slug: string;
      label: string;
      regionSlug: string;
      categorySlug: string;
    };

// v2.21-S3 — ISR + 알 수 없는 슬러그는 404.
// Next.js 16 segment config 는 literal 값만 받음 (const 변수 참조 X) — Vercel 빌드에서
// "Invalid segment configuration" 으로 잡힘. 숫자 / boolean 인라인 필수.
// generateStaticParams 로 빌드 타임에 23개 슬러그 미리 SSG, 그 후 1시간 ISR 로 갱신.
export const revalidate = 3600;
export const dynamicParams = false;

/** 모든 슬러그를 빌드 타임에 미리 생성. 신규 슬라이스 추가 시 빌드 한 번 더 돌리면 됨. */
export function generateStaticParams() {
  return [
    ...REGIONS.map((r) => ({ slug: r.slug })),
    ...PERIODS.map((p) => ({ slug: p.slug })),
    ...CATEGORIES.map((c) => ({ slug: c.slug })),
    // v2.29 — 지역×카테고리 조합 롱테일 랜딩 ("성수 패션 팝업" 등).
    ...REGIONS.flatMap((r) =>
      CATEGORIES.map((c) => ({ slug: `${r.slug}-${c.slug}` })),
    ),
  ];
}

function resolveSlice(slug: string): Slice | null {
  const r = regionBySlug(slug);
  if (r) return { kind: "region", slug: r.slug, label: r.label };
  const p = periodBySlug(slug);
  if (p) return { kind: "period", slug: p.slug, label: p.label };
  const c = categoryBySlug(slug);
  if (c) return { kind: "category", slug: c.slug, label: c.label };
  // v2.29 — 지역-카테고리 조합 (예: "seongsu-fashion" → 성수 × 패션).
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
    case "region-category":
      return `region=${slice.regionSlug}&category=${slice.categorySlug}`;
  }
}

/** 백엔드 visible markers — SSG 빌드 타임에 fetch. */
async function fetchMarkers(): Promise<Marker[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? SITE_URL;
  try {
    const res = await fetch(`${apiBase}/api/map/markers`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return (await res.json()) as Marker[];
  } catch {
    return [];
  }
}

function filterBySlice(markers: Marker[], slice: Slice): Marker[] {
  switch (slice.kind) {
    case "region":
      return markers.filter((m) => classifyRegion(m.location) === slice.slug);
    case "period":
      return markers.filter((m) =>
        matchesPeriod(m.startDate, m.endDate, slice.slug as never),
      );
    case "category":
      return markers.filter((m) => classifyCategory(m.category) === slice.slug);
    case "region-category":
      return markers.filter(
        (m) =>
          classifyRegion(m.location) === slice.regionSlug &&
          classifyCategory(m.category) === slice.categorySlug,
      );
  }
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
    "region-category": `${slice.label} 팝업스토어 추천`,
  };
  const descriptions: Record<Slice["kind"], string> = {
    region: `${slice.label}에서 진행 중인 팝업스토어 일정과 위치를 한눈에. 위시 등록, 마감 D-3 알림, 같이 갈 동행 매칭까지 무료.`,
    period: `${slice.label} 서울에서 열리는 팝업스토어 목록. 영업 시간, 위치, 종료일까지 정리.`,
    category: `${slice.label} 관련 팝업스토어 모음. 신상 / 인기 / 마감 임박 한눈에 보기.`,
    "region-category": `${slice.label} 팝업스토어를 한눈에. 위치·일정·카테고리별 큐레이션, 위시 등록과 마감 D-3 알림까지 무료.`,
  };

  const title = titles[slice.kind];
  const description = descriptions[slice.kind];
  const url = `${SITE_URL}/popups/${slice.slug}`;

  // v2.29 — 조합 슬라이스가 결과 0곳이면 thin content 방지 위해 noindex (페이지 접근·내부링크는 유지).
  let robots: Metadata["robots"] | undefined;
  if (slice.kind === "region-category") {
    const count = filterBySlice(await fetchMarkers(), slice).length;
    if (count === 0) robots = { index: false, follow: true };
  }

  return {
    title,
    description,
    robots,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · POP-SPOT`,
      description,
      url,
      type: "website",
    },
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
  const mainHref = `${SITE_URL}/?tab=MAP&${deepLinkQuery(slice)}`;

  const headingByKind: Record<Slice["kind"], string> = {
    region: `${slice.label} 팝업스토어 ${count}곳`,
    period: `${slice.label} 진행 중인 팝업 ${count}곳`,
    category: `${slice.label} 팝업스토어 ${count}곳`,
    "region-category": `${slice.label} 팝업스토어 ${count}곳`,
  };
  const introByKind: Record<Slice["kind"], string> = {
    region: `${slice.label}에서 진행 중인 팝업스토어를 POP-SPOT 이 자동 큐레이션 합니다. 영업 기간이 끝난 팝업은 자동으로 빠지고, 신규 팝업은 매일 04시 / 16시에 갱신.`,
    period: `${slice.label} 서울 곳곳에서 열리는 팝업스토어. 위치 · 카테고리 · 마감일을 지도 한 화면에서 확인.`,
    category: `${slice.label} 관련 신상 / 인기 팝업스토어. 위시 등록 시 마감 3일 전 알림 발송.`,
    "region-category": `${slice.label} 팝업스토어를 POP-SPOT 이 자동 큐레이션. 해당 지역·카테고리에 맞는 팝업만 모아 위치와 일정을 한눈에.`,
  };

  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft size={14} /> 메인으로
        </Link>

        <div className="flex items-center gap-2 mb-3">
          <SliceIcon kind={slice.kind} />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground">
            {slice.kind === "region"
              ? "REGION"
              : slice.kind === "period"
                ? "WHEN"
                : slice.kind === "category"
                  ? "CATEGORY"
                  : "REGION × CATEGORY"}
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
          {headingByKind[slice.kind]}
        </h1>

        <p className="text-sm md:text-base text-gray-600 dark:text-white/70 max-w-2xl mb-8">
          {introByKind[slice.kind]}
        </p>

        {count === 0 ? (
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-bold mb-2">
              지금은 {slice.label} 슬라이스에 진행 중인 팝업이 없어요
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              새 팝업은 매일 04시 / 16시에 자동 수집됩니다. 메인 지도에서 전체 팝업을 둘러보세요.
            </p>
            <Link
              href="/?tab=MAP"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-lime-300 text-ink-900 font-bold text-sm hover:bg-lime-400 transition"
            >
              전체 지도 보기
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-lg shadow-black/5 dark:shadow-black/30 p-6 md:p-8 mb-6">
              <h2 className="text-lg md:text-xl font-bold mb-4">진행 중 팝업 목록</h2>
              <ul className="space-y-3">
                {filtered.slice(0, 30).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-white/5 last:border-0"
                  >
                    <span className="text-lime-500 mt-1">
                      <MapPin size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm md:text-base font-bold truncate">{m.name}</h3>
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
                ))}
              </ul>
              {filtered.length > 30 && (
                <p className="text-xs text-muted-foreground mt-3">
                  외 {filtered.length - 30}곳 더 — 메인 지도에서 전체 확인
                </p>
              )}
            </section>

            <Link
              href={`/?tab=MAP&${deepLinkQuery(slice)}`}
              className="block w-full text-center px-6 py-4 rounded-2xl bg-lime-300 text-ink-900 font-black text-base md:text-lg hover:bg-lime-400 transition shadow-lg"
            >
              지도에서 {slice.label} 팝업 보기 →
            </Link>
          </>
        )}

        <SliceCloud current={slice} />

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

function SliceIcon({ kind }: { kind: Slice["kind"] }) {
  const cls = "text-lime-500";
  if (kind === "region") return <MapPin size={16} className={cls} />;
  if (kind === "period") return <Calendar size={16} className={cls} />;
  return <Tag size={16} className={cls} />;
}

/** 다른 슬라이스로 가는 내부 링크 클라우드 — SEO + 사용자 회유. */
function SliceCloud({ current }: { current: Slice }) {
  const others: { slug: string; label: string; kind: Slice["kind"] }[] = [
    ...REGIONS.map((r) => ({ slug: r.slug, label: r.label, kind: "region" as const })),
    ...PERIODS.map((p) => ({ slug: p.slug, label: p.label, kind: "period" as const })),
    ...CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, kind: "category" as const })),
  ].filter((s) => s.slug !== current.slug);

  return (
    <nav
      aria-label="다른 슬라이스로 이동"
      className="mt-10 pt-6 border-t border-gray-200 dark:border-white/10"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        다른 슬라이스 둘러보기
      </h3>
      <ul className="flex flex-wrap gap-2">
        {others.map((s) => (
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
      a: "매일 04시 / 16시에 자동 수집합니다. 신규 팝업이 등록되면 BROWSE 와 지도에 즉시 반영됩니다.",
    },
    {
      q: `${slice.label} 슬라이스는 어떻게 분류되나요?`,
      a:
        slice.kind === "region"
          ? "팝업 주소의 동/로 이름을 기준으로 분류합니다. 정확한 위치는 지도에서 확인하세요."
          : slice.kind === "period"
            ? "팝업의 운영 시작일·종료일을 기준으로 해당 기간 안에 한 번이라도 열리면 포함됩니다."
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
