import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Calendar, Tag, Clock, Flame, MessageSquare } from 'lucide-react';

import { REGIONS, classifyRegion, regionBySlug } from '@/lib/regions';
import { LANDING_COPY, type LandingCopy, type MetaPick, type PickReason } from '@/lib/landingCopy';
import { localizedLabel } from '@/lib/localeLabel';
import { bilingual } from '@/lib/bilingual';
import type { Locale } from '@/lib/i18n';
import { LOCALE_PATH, slugAlternates } from '@/lib/localeRoutes';
import { localizedPath } from '@/lib/localePath';
import { CRAWL_REFRESH_BY_LOCALE } from '@/lib/siteCopy';
import { groupSameEvent } from '@/lib/groupSameEvent';
import {
  getPeriods,
  CATEGORIES,
  BRANDS,
  matchesPeriod,
  classifyCategory,
  periodBySlug,
  categoryBySlug,
  brandBySlug,
  parseDate,
  startOfDay,
  kstTodayStart,
  isExpired,
  isStale,
} from '@/lib/popupSlices';

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
 * <p>약관 §10-2 가 실제로 요구하는 것은 두 가지다 — 원문 텍스트를 그대로 복제·저장·노출하지 않을 것,
 * 그리고 <b>상세페이지에서 원문으로 이동할 출처 링크를 노출할 것</b>. 상세로 가는 링크를 막으라는
 * 조항이 아니다(예전 주석이 그렇게 읽고 있었다). 여기서 이름·위치·기간·D-day 만 쓰는 것은 원문 미복제
 * 요건을 지키기 위해서고, D-day 는 새 정보가 아니라 기존 endDate 의 재포맷이라 허용된다.
 *
 * <p>각 행은 /popup/[id] 로 링크한다. 같은 /api/map/markers 데이터의 같은 최소 목록을 홈
 * (BrowseSection) 이 이미 상세로 링크하고 있어서, 랜딩만 막아둘 이유가 없었다. 다만 상세는
 * app/popup/[id]/layout.tsx 에서 noindex 다 — §10-2 때문이 아니라 §14(회원 채팅이 같은 URL 에
 * 산다) 때문이다. 이유를 잘못 귀속시키면 다음 사람이 엉뚱한 걸 되돌린다.
 *
 * <p>SSG(generateStaticParams) + ISR(revalidate=3600). 실시간 데이터는 메인 지도로 유도.
 */

const SITE_URL = 'https://popspot.co.kr';
// 갱신 주기 카피는 홈 SEO 블록과도 공유한다(한 곳만 고치면 전부 반영). @see src/lib/siteCopy.ts

type Marker = {
  id: number;
  /**
   * 한국어 원문. <b>분류가 이 값을 쓴다</b>(classifyRegion, 브랜드 키워드 매칭).
   *
   * <p>번역이 있어도 이 값으로 계속 거른다 — 번역본으로 바꾸면 성수·홍대 분류가 통째로 깨진다.
   */
  name: string;
  location: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  /**
   * v2.51 — 외국어 표시용. 없으면 원문을 쓴다.
   *
   * <p>백엔드가 확신이 없으면 채우지 않는다. 틀린 이름을 자신 있게 보여주면 관광객이 엉뚱한 곳으로
   * 간다(현대백화점을 'The Hyundai' 로 옮기면 여의도의 다른 매장이 된다).
   */
  nameEn?: string | null;
  nameJa?: string | null;
  locationEn?: string | null;
  locationJa?: string | null;
};

type Slice =
  | { kind: 'region'; slug: string; label: string }
  | { kind: 'period'; slug: string; label: string }
  | { kind: 'category'; slug: string; label: string }
  | { kind: 'brand'; slug: string; label: string; keywords: string[] }
  | {
      kind: 'region-category';
      slug: string;
      label: string;
      regionSlug: string;
      categorySlug: string;
    }
  | {
      kind: 'region-period';
      slug: string;
      label: string;
      regionSlug: string;
      periodSlug: string;
    }
  | {
      kind: 'category-period';
      slug: string;
      label: string;
      categorySlug: string;
      periodSlug: string;
    };

// v2.21-S3 — ISR + 알 수 없는 슬러그는 404.
// Next.js 16 segment config 는 literal 값만 받음 (const 변수 참조 X).
export const revalidate = 3600;
export const dynamicParams = false;

/** 모든 슬러그를 빌드 타임에 미리 생성. 신규 슬라이스 추가 시 빌드 한 번 더 돌리면 됨. */
export function generateStaticParams() {
  return [
    ...REGIONS.map((r) => ({ slug: r.slug })),
    ...getPeriods().map((p) => ({ slug: p.slug })),
    ...CATEGORIES.map((c) => ({ slug: c.slug })),
    ...BRANDS.map((b) => ({ slug: b.slug })),
    ...REGIONS.flatMap((r) => CATEGORIES.map((c) => ({ slug: `${r.slug}-${c.slug}` }))),
    ...REGIONS.flatMap((r) => getPeriods().map((p) => ({ slug: `${r.slug}-${p.slug}` }))),
    ...CATEGORIES.flatMap((c) => getPeriods().map((p) => ({ slug: `${c.slug}-${p.slug}` }))),
  ];
}

/**
 * 슬러그 → 슬라이스. 표시 이름은 화면 언어로 고른다.
 *
 * <p>슬러그 자체는 언제나 로마자라 언어와 무관하다({@code /ja/popups/seongsu}). 주소를 언어마다
 * 다르게 만들면 이미 색인된 한국어 주소와 짝이 안 맞고, 같은 곳을 가리키는지 검색엔진이 알 수 없다.
 */
function resolveSlice(slug: string, locale: Locale): Slice | null {
  const L = (d: { label: string; labelEn: string; labelJa: string }) => localizedLabel(d, locale);
  const r = regionBySlug(slug);
  if (r) return { kind: 'region', slug: r.slug, label: L(r) };
  const p = periodBySlug(slug);
  if (p) return { kind: 'period', slug: p.slug, label: L(p) };
  const c = categoryBySlug(slug);
  if (c) return { kind: 'category', slug: c.slug, label: L(c) };
  const b = brandBySlug(slug);
  if (b) return { kind: 'brand', slug: b.slug, label: L(b), keywords: b.keywords };
  for (const reg of REGIONS) {
    if (!slug.startsWith(`${reg.slug}-`)) continue;
    const rest = slug.slice(reg.slug.length + 1);
    const cat = categoryBySlug(rest);
    if (cat) {
      return {
        kind: 'region-category',
        slug,
        label: `${L(reg)} ${L(cat)}`,
        regionSlug: reg.slug,
        categorySlug: cat.slug,
      };
    }
    // 지역×시점 ("성수 이번 주"). 카테고리 slug 와 시점 slug 는 겹치지 않으므로 순서는 무관하다.
    const per = periodBySlug(rest);
    if (per) {
      return {
        kind: 'region-period',
        slug,
        // 한국어는 "이번 주 성수" 가 실제 검색 어순이지만, 영어는 "Seongsu — This week" 가 자연스럽다.
        label: locale === 'ko' ? `${L(per)} ${L(reg)}` : `${L(reg)} — ${L(per)}`,
        regionSlug: reg.slug,
        periodSlug: per.slug,
      };
    }
  }
  for (const cat of CATEGORIES) {
    if (!slug.startsWith(`${cat.slug}-`)) continue;
    const rest = slug.slice(cat.slug.length + 1);
    const per = periodBySlug(rest);
    if (!per) continue;
    const label =
      locale === 'ko'
        ? `${L(per)} ${L(cat)}`
        : locale === 'ja'
          ? `${L(per)}の${L(cat)}`
          : `${L(cat)} ${L(per)}`;
    return {
      kind: 'category-period',
      slug,
      label,
      categorySlug: cat.slug,
      periodSlug: per.slug,
    };
  }
  return null;
}

/** 슬라이스 → 메인 지도 deep link 쿼리스트링. */
function deepLinkQuery(slice: Slice): string {
  switch (slice.kind) {
    case 'region':
      return `region=${slice.slug}`;
    case 'period':
      return `period=${slice.slug}`;
    case 'category':
      return `category=${slice.slug}`;
    case 'brand':
      // 지도엔 브랜드 필터 파라미터가 없어 전체 지도로 유도(랜딩 목록이 SEO 본체).
      return '';
    case 'region-category':
      return `region=${slice.regionSlug}&category=${slice.categorySlug}`;
    case 'region-period':
      return `region=${slice.regionSlug}&period=${slice.periodSlug}`;
    case 'category-period':
      return `category=${slice.categorySlug}&period=${slice.periodSlug}`;
  }
}

/** 일시적 장애에 대한 재시도 횟수. 백엔드 재시작(수십 초) 정도는 넘길 수 있게. */
const MARKER_FETCH_ATTEMPTS = 3;
const MARKER_RETRY_BASE_MS = 1500;

/**
 * 비상 빌드 탈출구.
 *
 * <p>백엔드가 길게 내려간 동안에도 프론트 핫픽스를 내보내야 할 때만 쓴다. 켜져 있으면 빌드는 통과하지만
 * 로그에 크게 남는다. 기본값은 꺼짐 — 조용히 빈 페이지를 만드는 것이 원래 문제였다.
 */
const ALLOW_EMPTY_BUILD = process.env.ALLOW_EMPTY_SEO_BUILD === 'true';

/**
 * 백엔드 visible markers — SSG 빌드 타임에 fetch.
 *
 * <p>이전에는 4xx·5xx·타임아웃을 전부 빈 배열로 바꿔, 백엔드가 죽은 채로 빌드해도 종료 코드 0 에 랜딩
 * 160여 개가 "0곳" 으로 생성됐다. 파이프라인에서는 성공으로 보이고 사용자·검색엔진에는 빈 페이지가 나갔다.
 *
 * <p>이제 원인별로 나눈다 — 설정 오류는 즉시 실패(사람 실수라 빨리 터지는 게 낫다), 일시적 장애는 재시도 후
 * 실패, 그래도 내보내야 하면 {@code ALLOW_EMPTY_SEO_BUILD=true} 로 명시적으로 허용한다.
 */
async function fetchMarkers(): Promise<Marker[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  // 설정 오류 — 재시도해도 소용없다. 즉시 멈춘다.
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    throw new Error(
      `[popups/slug] NEXT_PUBLIC_API_URL 이 없거나 형식이 잘못되었습니다(값: ${apiBase ?? '미설정'}). ` +
        `빈 SEO 페이지를 만들지 않기 위해 빌드를 중단합니다.`,
    );
  }

  let lastError = '';
  for (let attempt = 1; attempt <= MARKER_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${apiBase}/api/map/markers`, { next: { revalidate: 3600 } });
      if (res.ok) return (await res.json()) as Marker[];

      lastError = `HTTP ${res.status}`;
      // 4xx 는 재시도해도 같은 결과다(경로·인증 문제). 5xx 만 기다려 본다.
      if (res.status < 500) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (attempt < MARKER_FETCH_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, MARKER_RETRY_BASE_MS * attempt));
    }
  }

  if (ALLOW_EMPTY_BUILD) {
    console.error(
      `[popups/slug] ⚠️ 마커 fetch 실패(${lastError}) — ALLOW_EMPTY_SEO_BUILD=true 라 빈 목록으로 진행합니다. ` +
        `이 빌드의 SEO 랜딩은 "0곳" 으로 생성됩니다.`,
    );
    return [];
  }

  throw new Error(
    `[popups/slug] 마커 fetch 실패(${MARKER_FETCH_ATTEMPTS}회 시도, 마지막 오류: ${lastError}). ` +
      `빈 SEO 페이지를 배포하지 않기 위해 빌드를 중단합니다. ` +
      `백엔드 장애 중에도 반드시 내보내야 하면 ALLOW_EMPTY_SEO_BUILD=true 로 실행하세요.`,
  );
}

function filterBySlice(markers: Marker[], slice: Slice): Marker[] {
  switch (slice.kind) {
    case 'region':
      return markers.filter((m) => classifyRegion(m.location) === slice.slug);
    case 'period':
      return markers.filter((m) => matchesPeriod(m.startDate, m.endDate, slice.slug as never));
    case 'category':
      return markers.filter((m) => classifyCategory(m.category) === slice.slug);
    case 'brand': {
      const kws = slice.keywords.map((k) => k.toLowerCase());
      return markers.filter((m) => {
        const hay = `${m.name ?? ''} ${m.location ?? ''}`.toLowerCase();
        return kws.some((k) => hay.includes(k));
      });
    }
    case 'region-category':
      return markers.filter(
        (m) =>
          classifyRegion(m.location) === slice.regionSlug &&
          classifyCategory(m.category) === slice.categorySlug,
      );
    case 'region-period':
      return markers.filter(
        (m) =>
          classifyRegion(m.location) === slice.regionSlug &&
          matchesPeriod(m.startDate, m.endDate, slice.periodSlug as never),
      );
    case 'category-period':
      return markers.filter(
        (m) =>
          classifyCategory(m.category) === slice.categorySlug &&
          matchesPeriod(m.startDate, m.endDate, slice.periodSlug as never),
      );
  }
}

/* ===== D-day 유틸 (기존 endDate 재포맷 — 새 정보 아님, §10-2 준수) ===== */

/**
 * 종료된 팝업을 뺀 마커 목록.
 *
 * <p>본문과 {@link generateMetadata} 가 <b>같은 함수</b>를 쓰게 해서 판정이 갈리지 않도록 한다.
 * 예전엔 본문만 만료를 걸러서, 브랜드에 만료 팝업만 남으면 본문은 "0곳" 인데 메타데이터는 결과가
 * 있다고 보고 noindex 를 안 붙였다 — 빈 페이지가 색인되는 경로였다.
 */
async function liveMarkers(): Promise<Marker[]> {
  const today = kstTodayStart();
  return (await fetchMarkers()).filter(
    (m) => !isExpired(m.endDate, today) && !isStale(m.startDate, m.endDate, today),
  );
}

/** endDate 까지 남은 일수. 0=오늘 마감, 1=내일, 음수=이미 종료, null=종료일 없음. */
function ddayOf(endDate: string | null, today: Date): number | null {
  const end = parseDate(endDate);
  if (!end) return null;
  return Math.round((startOfDay(end).getTime() - today.getTime()) / 86400000);
}

/** D-day → 배지(문구·색). 상시(null)·종료(음수)는 무배지. */
function ddayBadge(dday: number | null, copy: LandingCopy): { text: string; cls: string } | null {
  if (dday === null || dday < 0) return null;
  if (dday === 0) return { text: copy.ddayToday, cls: 'bg-red-500 text-white' };
  if (dday === 1) return { text: copy.ddayTomorrow, cls: 'bg-red-500 text-white' };
  // 'D-3' 표기는 한국에서만 통한다. 영어권은 '3d', 일본은 'あと3日' 로 읽는다.
  if (dday <= 3) return { text: copy.ddayValue(dday), cls: 'bg-orange-500 text-white' };
  if (dday <= 7) return { text: copy.ddayValue(dday), cls: 'bg-amber-400 text-ink-900' };
  return { text: copy.ddayOngoing, cls: 'bg-lime-300 text-ink-900' };
}

/**
 * 아직 안 끝난 것 중 가장 빨리 마감하는 날 — "7/30(D-3)". 종료일 있는 팝업이 없으면 null.
 *
 * <p>검색 결과 설명에 쓴다. "포켓몬 팝업스토어 일정" 같은 질의에 실제 날짜로 답하기 위한 것으로,
 * 이 부류가 실측 CTR 2.31% 로 가장 낮았다(노출 216 · 클릭 5).
 */
function nearestDeadline(markers: Marker[], locale: Locale): string | null {
  const today = kstTodayStart();
  let best: Date | null = null;
  for (const m of markers) {
    const end = parseDate(m.endDate);
    if (!end) continue;
    if (startOfDay(end).getTime() < today.getTime()) continue; // 이미 지난 건 제외
    if (!best || end.getTime() < best.getTime()) best = end;
  }
  if (!best) return null;
  const copy = LANDING_COPY[locale];
  const dday = Math.round((startOfDay(best).getTime() - today.getTime()) / 86400000);
  // "D-2" 는 한국에서만 통하는 표기다. 언어별 표현을 쓴다(영어 "2d", 일본어 "あと2日").
  return copy.deadlineFormat(copy.shortDate(best), copy.ddayValue(dday));
}

/** 이름·지역을 검색 결과 길이에 맞게 줄인다. 잘릴 바에는 우리가 줄이는 편이 낫다. */
function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? '').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * 언어에 맞는 짧은 지역명. "서울 성수" 처럼 앞에 붙는 시(市)는 뺀다 — 어차피 전부 서울이라 자리만
 * 차지한다.
 *
 * <p>이름과 <b>같은 언어</b>를 쓴다. 이름만 번역본을 쓰면 영어 설명에 "North Face Kids Popup
 * (until Aug 4, 대전신세계)" 처럼 한 문장 안에서 언어가 섞인다.
 */
function shortLocation(m: Marker, locale: Locale): string {
  const translated = locale === 'en' ? m.locationEn : locale === 'ja' ? m.locationJa : null;
  const text = translated || m.location || '';
  return clip(text.replace(/^(서울|Seoul)\s*(특별시)?\s*[,·]?\s*/i, ''), widthFor(locale, 14));
}

/** 언어에 맞는 표시 이름. 번역이 없으면 원문. */
function displayName(m: Marker, locale: Locale): string {
  const translated = locale === 'en' ? m.nameEn : locale === 'ja' ? m.nameJa : null;
  return clip(translated || m.name, widthFor(locale, 22));
}

/**
 * 자를 길이 — 영어는 넉넉하게.
 *
 * <p>검색 결과 설명이 잘리는 기준은 글자 수가 아니라 픽셀 폭이라, 한 글자가 넓은 한글·일본어는 80자
 * 안팎에서 잘리고 영어는 그 두 배쯤 들어간다. 같은 숫자로 자르면 영어만 쓸데없이 뭉텅 날아간다.
 */
function widthFor(locale: Locale, base: number): number {
  return locale === 'en' ? Math.round(base * 1.6) : base;
}

/**
 * 검색 결과 설명에 넣을 상위 몇 곳 — <b>목록과 같은 순서</b>(마감 임박순)로 고른다.
 *
 * <p>순서를 따로 두면 설명에 적힌 팝업이 정작 목록 맨 위에 없어서, 눌러 들어온 사람이 못 찾는다.
 */
function metaPicks(markers: Marker[], locale: Locale, n: number): MetaPick[] {
  const today = kstTodayStart();
  const copy = LANDING_COPY[locale];
  return markers
    .map((m) => {
      const end = parseDate(m.endDate);
      const valid = end && startOfDay(end).getTime() >= today.getTime();
      return { m, end: valid ? end : null };
    })
    .sort((a, b) => (a.end?.getTime() ?? Infinity) - (b.end?.getTime() ?? Infinity))
    .slice(0, n)
    .map(({ m, end }) => ({
      name: displayName(m, locale),
      deadline: end ? copy.shortDate(end) : '',
      location: shortLocation(m, locale),
    }));
}

/**
 * "지금 고른다면" 세 장 — <b>규칙만으로</b> 고른다. LLM 도 손으로 쓴 글도 쓰지 않는다.
 *
 * <p>153곳을 마감임박순으로 늘어놓는 것은 정렬이지 고를 근거가 아니다. 세 장은 서로 다른 이유로
 * 고르고, 그 이유를 카드에 적는다 — 이유를 안 적으면 그냥 또 하나의 목록이 된다.
 *
 * <ul>
 *   <li>곧 끝나요 — 마감이 가장 임박한 곳
 *   <li>막 시작했어요 — 최근 7일 안에 문을 연 곳 중 가장 최근
 *   <li>여유 있게 — 마감까지 14일 넘게 남은 곳 중 가장 최근에 연 곳
 * </ul>
 *
 * <p>규칙에 맞는 것이 없으면 그 자리는 <b>비운다.</b> 억지로 채우면 이유가 거짓이 된다.
 */
function nowPicks(
  markers: Marker[],
  today: Date,
): { m: Marker; reason: PickReason; dday: number | null }[] {
  const picked: { m: Marker; reason: PickReason; dday: number | null }[] = [];
  const used = new Set<number>();
  const take = (m: Marker | undefined, reason: PickReason) => {
    if (!m || used.has(m.id)) return;
    used.add(m.id);
    picked.push({ m, reason, dday: ddayOf(m.endDate, today) });
  };

  const live = markers
    .map((m) => ({ m, end: parseDate(m.endDate), start: parseDate(m.startDate) }))
    .filter((x) => !x.end || startOfDay(x.end).getTime() >= today.getTime());

  const byDeadline = [...live]
    .filter((x) => x.end)
    .sort((a, b) => a.end!.getTime() - b.end!.getTime());
  take(byDeadline[0]?.m, 'closing');

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const justOpened = live
    .filter((x) => x.start && startOfDay(x.start) >= weekAgo && startOfDay(x.start) <= today)
    .sort((a, b) => b.start!.getTime() - a.start!.getTime());
  take(justOpened.find((x) => !used.has(x.m.id))?.m, 'opened');

  const roomyFrom = new Date(today);
  roomyFrom.setDate(roomyFrom.getDate() + 14);
  const roomy = live
    .filter((x) => x.end && startOfDay(x.end) >= roomyFrom)
    .sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));
  take(roomy.find((x) => !used.has(x.m.id))?.m, 'roomy');

  return picked;
}

/**
 * JSON-LD 를 {@code <script>} 안에 넣을 때 쓰는 직렬화.
 *
 * <p>{@code JSON.stringify} 는 {@code <} 를 그대로 둔다. 아래 ItemList 에는 <b>크롤링해 온 팝업
 * 이름</b>이 들어가므로, 이름에 {@code </script>} 가 섞여 들어오면 스크립트 블록이 그 자리에서 끊기고
 * 뒤가 문서 본문으로 해석된다(스크립트 주입 경로). {@code <} 를 유니코드 이스케이프로 바꾸면 JSON
 * 의미는 그대로면서 HTML 파서가 태그로 읽지 않는다.
 */
function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

/** JSON-LD 날짜(YYYY-MM-DD). parseDate 가 현지 자정으로 만들므로 toISOString 을 쓰면 하루 밀린다. */
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 구조화 데이터에 담을 최대 개수. 성수처럼 193곳인 슬라이스도 있어 상한을 둔다(마감 임박순 앞에서부터). */
const MAX_JSONLD_EVENTS = 20;

/**
 * ItemList 에 담을 실제 팝업들 — schema.org Event.
 *
 * <p>v2.43 — 그 전까지 ItemList 는 {@code numberOfItems} 만 있는 껍데기였다. "15개가 있다" 고만
 * 말하고 그 15개가 뭔지는 안 알려주니 검색엔진이 얻을 게 없었다.
 *
 * <p>팝업은 이름·시작일·종료일·장소가 있는 전형적인 행사라 Event 가 그대로 들어맞는다. 구글은 행사
 * 정보를 받으면 검색 결과에 날짜를 직접 띄우는데, 실측에서 "일정" 이 들어간 검색어가 CTR 2.31% 로
 * 가장 낮았다(노출 216 · 클릭 5). 날짜를 보여주는 것이 그 질문에 대한 직접적인 답이다.
 *
 * <p>이름·시작일·장소가 없는 항목은 <b>건너뛴다.</b> Event 의 필수 항목이라 빠진 채로 내보내면 구글이
 * 오류로 처리하고, 하나만 잘못돼도 블록 전체가 무시될 수 있다. 실제로 수집 마커의 36% 는 시작일이
 * 없다 — 목록 화면에는 그대로 보이지만 구조화 데이터에는 넣지 않는다.
 *
 * <p>개별 팝업 주소({@code /popup/[id]})는 넣지 않는다 — noindex 라(약관 §14) 색인하지 말라고 해 둔
 * 곳으로 검색 결과를 보낼 수는 없다. 팝업 정보가 이 페이지 안에 다 있으므로 링크 없는 형태가 맞다.
 */
function eventListElements(markers: Marker[], locale: Locale) {
  const items: unknown[] = [];
  for (const m of markers) {
    if (items.length >= MAX_JSONLD_EVENTS) break;
    if (!m.name || !m.location) continue;
    const start = parseDate(m.startDate);
    if (!start) continue;
    const end = parseDate(m.endDate);

    // 이 블록을 읽는 것은 사람이 아니라 검색엔진과 AI 도우미다. 영어 페이지인데 이름이 한글이면
    // 그대로 인용돼 영어 답변에 한글이 섞인다 — 실제로 ChatGPT·Perplexity 유입이 잡히고 있어
    // 여기 언어를 맞추는 것이 화면 문구만큼 중요하다.
    const name = bilingual(m.name, locale === 'en' ? m.nameEn : locale === 'ja' ? m.nameJa : null);
    const place = bilingual(
      m.location,
      locale === 'en' ? m.locationEn : locale === 'ja' ? m.locationJa : null,
    );

    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      item: {
        '@type': 'Event',
        name: name.display,
        // 원문은 버리지 않고 alternateName 으로 남긴다. 현지 표기를 함께 아는 편이 지도·현장에서
        // 쓸모 있고, 같은 행사를 다른 언어 판과 잇는 단서도 된다.
        ...(name.original ? { alternateName: name.original } : {}),
        startDate: ymdOf(start),
        ...(end ? { endDate: ymdOf(end) } : {}),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: place.display,
          address: place.display,
          ...(place.original ? { alternateName: place.original } : {}),
        },
      },
    });
  }
  return items;
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

export async function sliceMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const copy = LANDING_COPY[locale];
  const slice = resolveSlice(slug, locale);
  if (!slice) return { title: copy.notFound, robots: { index: false } };

  // v2.43 — 제목·설명에 실제 건수와 마감일을 넣는다.
  //
  // Search Console 실측(30일): 노출 2,187 · 클릭 103 · 평균 7.66위. 순위는 1페이지 하단인데 클릭이
  // 안 붙었다. 원인 후보 중 확실한 하나는 <b>검색 결과에 내보내는 문장에 구체적인 정보가 없다</b>는
  // 것이었다 — 코엑스(CTR 2.81%)와 니케(8.53%)의 설명문이 브랜드 이름만 빼면 글자까지 같았다.
  // "일정과 위치를 지도로 한눈에" 는 어느 페이지에 붙여도 말이 되는 문장이라, 옆에 뜨는 블로그가
  // "7/22~8/3 성수동" 을 보여줄 때 고를 이유가 없다.
  //
  // 페이지 본문은 이미 건수와 최단 마감을 계산해 h1 에 쓰고 있었다. 같은 값을 메타에도 보낸다.
  // "일정" 이 들어간 검색어가 노출 216 에 클릭 5(CTR 2.31%)로 가장 부진했는데, 날짜를 실제로
  // 보여주는 것이 그 질의에 대한 직접적인 답이기도 하다.
  //
  // 0곳이면 숫자를 빼고 기존 문장을 그대로 쓴다("0곳" 은 클릭을 부르지 않는다).
  // 같은 행사가 여러 줄로 들어온 것을 묶는다. 건수·제목·설명이 목록과 같은 수를 말해야 한다 —
  // 목록은 2줄인데 제목이 8곳이라고 하면 그 자체가 또 하나의 거짓말이다.
  const matched = groupSameEvent(filterBySlice(await liveMarkers(), slice)).map((g) => g.lead);
  const count = matched.length;

  // 결과 0곳이면 thin content 방지 위해 noindex (페이지 접근·내부링크는 유지).
  //
  // region-period 도 같은 취급 — 조합 65개 중 상당수가 0곳이다(예: 성북 이번 주말).
  //
  // v2.53 — region 단독도 넣는다. 그전에는 지역이 0곳이어도 색인됐다(실제로 마포가 0곳이었다).
  // 데이터가 빠지면 thin page 를 제 손으로 색인시키는 구멍이라, 지금 0곳이 없다고 두면 안 된다.
  // 종류와 관계없이 0곳이면 색인하지 않는다. 시점·카테고리도 데이터 변화나 분류 오류로 비게 될 수
  // 있고, 실제로 lifestyle 카테고리가 0곳인 상태가 확인됐다. 빈 페이지를 검색 결과에 남길 근거가 없다.
  //
  // 이 판정은 if 문이라 새 슬라이스를 추가해도 타입 검사에 걸리지 않는다. 종류를 늘릴 때
  // 위의 Record 들과 달리 여기는 컴파일러가 알려주지 않으므로 직접 확인해야 한다.
  //
  // <b>app/sitemap.ts 의 방출 조건과 반드시 같은 범위여야 한다.</b> 어긋나면 v2.42 사고가 재발한다
  // (noindex 인 URL 을 sitemap 에 실어 보내 크롤 예산만 쓰게 했다).
  let robots: Metadata['robots'] | undefined;
  if (count === 0) {
    robots = { index: false, follow: true };
  }

  // 제목에는 건수만. 앞머리 키워드("니케 팝업스토어")를 건드리지 않도록 뒤에 붙인다 — 검색 결과에서
  // 숫자는 클릭을 끌지만 제목 앞부분은 순위에 쓰이므로 순서를 바꾸지 않는다.
  const base = copy.titles[slice.kind](slice.label);
  const title = count > 0 ? copy.withCount(base, count) : base;

  // 설명 = 건수 + 최단 마감일 + 짧은 가치제안. 마감일 있는 팝업이 없으면 마감 문구를 뺀다.
  //
  // 기존 설명문을 그대로 뒤에 붙이면 "코엑스 팝업스토어 12곳 진행 중. … 코엑스 팝업스토어 일정과
  // 위치를 …" 처럼 이름이 두 번 나오고 100자를 넘는다. 구글은 한글 기준 80자 안팎에서 자르므로
  // 뒤가 통째로 날아간다. 그래서 짧은 꼬리를 따로 두고, 구체적인 값을 앞에 놓는다.
  // 건수가 아니라 <b>실제 이름</b>으로 시작한다. "153곳 진행 중" 은 눌러 봐야 뭐가 있는지 알 수
  // 있어서 굳이 안 누른다 — 실측에서 대상이 특정된 질의만 눌렸다(40% vs 1.64%).
  // 첫 항목이 곧 최단 마감이므로 metaSoonest 는 겹친다. 설명은 80자 안팎에서 잘리니 뺀다.
  const picks = metaPicks(matched, locale, 2);
  const description =
    count > 0
      ? copy.metaWithNames(picks, Math.max(0, count - picks.length)) + ` ${copy.tails[slice.kind]}`
      : copy.descriptions[slice.kind](slice.label);

  // 한국 검색 성과에서 실제로 확인된 표현만 사용한다. 별도 얇은 페이지를 대량 생성하지 않고, 같은
  // 목록을 찾는 말(팝업/팝업스토어·일정·위치·지도·연도)을 한 문서의 검색 단서로 묶는다. 괄호 안의
  // 동적 날짜는 검색어로 쓰이지 않으므로 키워드에서는 제거한다.
  const keywordLabel = slice.label.replace(/\s*\([^)]*\)/g, '').trim();
  const koreanKeywords =
    locale === 'ko'
      ? [
          `${keywordLabel} 팝업`,
          `${keywordLabel} 팝업스토어`,
          `${keywordLabel} 팝업 일정`,
          `${keywordLabel} 팝업 위치`,
          `${keywordLabel} 팝업 지도`,
          `${keywordLabel} 팝업 ${kstTodayStart().getFullYear()}`,
        ]
      : undefined;

  const url = `${SITE_URL}${LOCALE_PATH[locale] === '/' ? '' : LOCALE_PATH[locale]}/popups/${slice.slug}`;

  return {
    title,
    description,
    keywords: koreanKeywords,
    robots,
    // 세 언어 판이 서로를 가리키게 한다. 한쪽만 선언하면 검색엔진이 연결을 무시해서, 주소를 나눈
    // 의미가 통째로 사라진다.
    alternates: slugAlternates(slice.slug, locale),
    openGraph: { title: `${title} · POP-SPOT`, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return sliceMetadata(slug, 'ko');
}

/* ============================== 페이지 ============================== */

export async function SliceLandingPage({ slug, locale }: { slug: string; locale: Locale }) {
  const copy = LANDING_COPY[locale];
  const refresh = CRAWL_REFRESH_BY_LOCALE[locale];
  const slice = resolveSlice(slug, locale);
  if (!slice) notFound();

  // 이미 끝난 팝업은 제외한다. 백엔드 만료 스케줄러가 지연·실패해도 사용자에게는 종료된 팝업이
  // 보이지 않아야 한다("성수 팝업" 으로 들어왔는데 닫힌 곳이 나오는 신뢰 문제). 이 페이지는
  // revalidate=3600 SSG 라 백엔드만 고치면 최대 1시간 지연이 생기므로 렌더 시점에도 한 겹 더 거른다.
  const todayStart = kstTodayStart();
  // generateMetadata 와 같은 순서로 묶는다. 두 곳이 어긋나면 검색 결과의 건수와 화면의 건수가
  // 달라져, 눌러 들어온 사람이 "다른 페이지인가?" 하고 되돌아간다.
  const groups = groupSameEvent(filterBySlice(await liveMarkers(), slice));
  const filtered = groups.map((g) => g.lead);
  const count = filtered.length;
  /** 대표 id → 같은 행사로 묶인 다른 줄 수. 배지에 쓴다. */
  const mergedCount = new Map(groups.map((g) => [g.lead.id, g.duplicates.length]));
  const deepLink = deepLinkQuery(slice);
  const home = LOCALE_PATH[locale];
  const mapHref = `${home === '/' ? '' : home}/?tab=MAP${deepLink ? `&${deepLink}` : ''}`;
  const mainHref = `${SITE_URL}${mapHref}`;

  // "지금 가야 할 이유" 훅 — 전부 기존 endDate/startDate 의 파생값(무료).
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

  const topPicks = nowPicks(filtered, todayStart);

  // 0곳일 때 대신 보여 줄 것 — 지금 열려 있는 아무 팝업이나 마감 임박순으로.
  //
  // 진행 중인 곳이 없는 슬러그에도 검색으로 사람이 들어온다(원신 11명 등). 그 사람에게
  // "없습니다" 만 주고 돌려보낼 이유가 없다. 같은 분류에서 못 찾으면 서울 전체에서 고른다.
  const alternatives =
    count === 0
      ? [...(await liveMarkers())]
          .map((m) => ({ m, dday: ddayOf(m.endDate, todayStart) }))
          .filter((x) => x.dday !== null && x.dday >= 0)
          .sort((a, b) => (a.dday ?? Infinity) - (b.dday ?? Infinity))
          .slice(0, 3)
      : [];

  const heading = copy.h1[slice.kind](slice.label, count);
  const intro = copy.lead[slice.kind](slice.label, refresh);

  // subcopy — 마감 임박이 있으면 손실회피 훅, 없으면 편익.
  const subcopy = minDday !== null ? copy.urgencyWithDday(minDday) : copy.urgencyPlain(slice.label);

  // Record 로 둬야 슬라이스 종류가 늘 때 헤딩·소개문과 함께 타입 검사에 걸린다(삼항은 조용히 통과).
  const kickerByKind: Record<Slice['kind'], string> = {
    region: 'REGION',
    period: 'WHEN',
    category: 'CATEGORY',
    brand: 'BRAND',
    'region-category': 'REGION × CATEGORY',
    'region-period': 'REGION × WHEN',
    'category-period': 'CATEGORY × WHEN',
  };
  const kicker = kickerByKind[slice.kind];

  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14">
        <Link
          href={home}
          className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft size={14} /> {copy.backHome}
        </Link>

        {/* 배지 — 진행 중이면 라임 펄스 점 + 카운트로 '살아있는' 신호 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
          <SliceIcon kind={slice.kind} />
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            {kicker}
          </span>
          {count > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-lime-600 dark:text-lime-300">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime-400 motion-safe:animate-pulse" />
              {copy.nowRunning(count)}
              {closingSoon > 0 && (
                <span className="text-orange-500">{copy.closingSoonSuffix(closingSoon)}</span>
              )}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-5xl font-black mb-3 leading-tight">{heading}</h1>

        <p className="text-sm md:text-base text-gray-600 dark:text-white/70 max-w-2xl mb-6">
          {count > 0 ? subcopy : intro}
        </p>

        {count > 0 && (
          <>
            {/* 긴급 스트립 — 가장 빠른 마감을 가장 크게 (핵심 전환 레버) */}
            <div className="mb-5 flex gap-2 md:gap-3">
              <StatCard label={copy.statRunning} value={copy.statCount(count)} />
              {minDday !== null && (
                <StatCard
                  label={copy.statSoonest}
                  value={copy.ddayValue(minDday)}
                  big
                  tone={minDday <= 3 ? 'hot' : 'lime'}
                />
              )}
              {openingToday > 0 && (
                <StatCard
                  label={copy.statOpeningToday}
                  value={copy.statOpeningTodayValue(openingToday)}
                />
              )}
            </div>

            {/* 라임 CTA 박스 — 편익 CTA + 마찰 제거 + 편익 예고 */}
            <section className="mb-8 rounded-2xl border border-lime-300/50 bg-lime-50 p-5 dark:bg-lime-300/[0.06] md:p-6">
              <Link
                href={mapHref}
                className="block w-full rounded-2xl bg-lime-300 px-6 py-4 text-center text-base font-black text-ink-900 shadow-lg transition hover:bg-lime-400 md:text-lg"
              >
                {copy.mapCtaPrimary(slice.label)}
              </Link>
              <p className="mt-2.5 text-center text-xs text-muted-foreground">
                {copy.freeAutoNote(refresh)}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {/* 실행 경로가 있는 것만 적는다. 알림·동행 매칭은 이 페이지에서 누를 수 있는
                    진입점이 없어(그리고 알림 기능 자체가 없어) 빼고, 실제로 되는 것만 남긴다. */}
                {[copy.badgeMap, copy.badgeSorted, copy.badgeFree].map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center rounded-pill border border-lime-300/50 bg-white/60 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-white/5 dark:text-white/70"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </section>

            {/* 지금 고른다면 — 전체 목록 '위'. 목록을 대체하지 않고 앞에 놓기만 한다.
                한 장만 보고 나간 322명 중 293명(91%)이 이 화면에서 나갔다. 이름·지역·날짜만
                153줄 늘어놓으면 고를 수가 없어서다. 목록 길이 자체는 전환과 무관했다(상관 -0.15). */}
            {topPicks.length > 0 && (
              <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-lg shadow-black/5 dark:shadow-black/30 p-6 md:p-8 mb-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold md:text-xl">
                  <Flame size={16} className="text-lime-500" /> {copy.pickHeading}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {topPicks.map(({ m, reason, dday }) => {
                    const badge = ddayBadge(dday, copy);
                    const shownName = bilingual(
                      m.name,
                      locale === 'en' ? m.nameEn : locale === 'ja' ? m.nameJa : null,
                    );
                    const shownPlace = bilingual(
                      m.location,
                      locale === 'en' ? m.locationEn : locale === 'ja' ? m.locationJa : null,
                    );
                    return (
                      <li
                        key={m.id}
                        className="relative rounded-xl border border-gray-200 p-4 transition-colors hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
                      >
                        <Link
                          href={localizedPath(`/popup/${m.id}`, locale)}
                          aria-label={copy.detailAria(shownName.display ?? m.name)}
                          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
                        />
                        {/* 왜 이걸 골랐는지 먼저 적는다. 이유가 없으면 그냥 또 하나의 목록이다. */}
                        <p className="text-[11px] font-black text-lime-600 dark:text-lime-300">
                          {copy.pickReasons[reason]}
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-sm font-bold">{shownName.display}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {badge && (
                            <span className={`rounded-pill px-2 py-0.5 font-black ${badge.cls}`}>
                              {badge.text}
                            </span>
                          )}
                          <span className="truncate">{shownPlace.display || copy.noLocation}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {/* 무엇을 기준으로 골랐는지 밝힌다. 안 밝히면 광고로 읽힌다. */}
                <p className="mt-3 text-xs text-muted-foreground">{copy.pickNote}</p>
              </section>
            )}

            {/* 목록 — 마감임박순 + D-day 배지 (기존 기간 재포맷) */}
            <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-lg shadow-black/5 dark:shadow-black/30 p-6 md:p-8 mb-6">
              <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-orange-500" /> {copy.listHeading}
              </h2>
              <ul className="space-y-3">
                {sorted.slice(0, 30).map(({ m, dday }) => {
                  const badge = ddayBadge(dday, copy);
                  const shownName = bilingual(
                    m.name,
                    locale === 'en' ? m.nameEn : locale === 'ja' ? m.nameJa : null,
                  );
                  const shownPlace = bilingual(
                    m.location,
                    locale === 'en' ? m.locationEn : locale === 'ja' ? m.locationJa : null,
                  );
                  return (
                    <li
                      key={m.id}
                      className="relative flex items-start gap-3 py-2 border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      {/* 행 전체를 덮는 링크. 배지·기간 텍스트를 링크 본문에 넣으면 스크린리더가
                          "누데이크 팝업 D-3 서울 성동구 2026-07-01 ~ 2026-07-31 링크" 로 읽어
                          목록 훑기가 불가능해진다. aria-label 로 이름만 읽히게 한다. */}
                      <Link
                        href={localizedPath(`/popup/${m.id}`, locale)}
                        aria-label={copy.detailAria(shownName.display ?? m.name)}
                        className="absolute inset-0 z-10 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
                      />
                      <span className="text-lime-500 mt-1">
                        <MapPin size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm md:text-base font-bold truncate">
                            {shownName.display}
                          </h3>
                          {badge && (
                            <span
                              className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-black ${badge.cls}`}
                            >
                              {badge.text}
                            </span>
                          )}
                          {/* 묶었다는 사실을 밝힌다. 조용히 줄이면 "왜 빠졌지" 가 되고,
                              밝히면 "여러 곳에서 확인된 행사" 라는 신뢰 신호가 된다. */}
                          {(mergedCount.get(m.id) ?? 0) > 0 && (
                            <span className="shrink-0 rounded-pill bg-black/5 px-2 py-0.5 text-[11px] font-bold text-muted-foreground dark:bg-white/10">
                              {copy.mergedBadge((mergedCount.get(m.id) ?? 0) + 1)}
                            </span>
                          )}
                        </div>
                        {/* 번역이 있을 때만 원문을 남긴다. 지도 앱에 넣거나 현장에서 물어볼 때
                            쓰는 것은 번역명이 아니라 이쪽이다. lang 을 붙여 스크린리더가
                            영어 문맥에서도 한국어로 읽게 한다. */}
                        {shownName.original && (
                          <p className="truncate text-xs text-muted-foreground/70" lang="ko">
                            {shownName.original}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {shownPlace.display ?? copy.noLocation}
                        </p>
                        {shownPlace.original && (
                          <p className="truncate text-xs text-muted-foreground/70" lang="ko">
                            {shownPlace.original}
                          </p>
                        )}
                        {(m.startDate || m.endDate) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {m.startDate ?? '?'} ~ {m.endDate ?? '?'}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > 30 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {copy.moreCount(filtered.length - 30)}
                </p>
              )}
            </section>

            <Link
              href={mapHref}
              className="block w-full text-center px-6 py-4 rounded-2xl bg-lime-300 text-ink-900 font-black text-base md:text-lg hover:bg-lime-400 transition shadow-lg"
            >
              {copy.mapCtaSecondary(slice.label)}
            </Link>
          </>
        )}

        {count === 0 && (
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-bold mb-2">{copy.emptyHeading(slice.label)}</h2>
            <p className="text-sm text-muted-foreground mb-4">{copy.emptyBody(refresh)}</p>
            <Link
              href={`${home === '/' ? '' : home}/?tab=MAP`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-pill bg-lime-300 text-ink-900 font-bold text-sm hover:bg-lime-400 transition"
            >
              {copy.mapCta}
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              {/* "새 팝업 열릴 때 알림" 은 구현이 존재하지 않아 제거했다. 위시 등록 자체는 되므로
                  그것만 남긴다. */}
              {copy.emptyNote}
            </p>

            {/* 빈손으로 돌려보내지 않는다. 검색해서 들어온 사람에게 "없습니다" 만 주면
                그 사람은 다시 검색창으로 돌아간다. */}
            {alternatives.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-5 dark:border-white/10">
                <h3 className="text-sm font-bold">{copy.altHeading(slice.label)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{copy.altNote}</p>
                <ul className="mt-3 space-y-2">
                  {alternatives.map(({ m, dday }) => {
                    const badge = ddayBadge(dday, copy);
                    const shownName = bilingual(
                      m.name,
                      locale === 'en' ? m.nameEn : locale === 'ja' ? m.nameJa : null,
                    );
                    const shownPlace = bilingual(
                      m.location,
                      locale === 'en' ? m.locationEn : locale === 'ja' ? m.locationJa : null,
                    );
                    return (
                      <li key={m.id} className="relative flex items-center gap-2 text-sm">
                        <Link
                          href={localizedPath(`/popup/${m.id}`, locale)}
                          aria-label={copy.detailAria(shownName.display ?? m.name)}
                          className="absolute inset-0 z-10 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
                        />
                        <MapPin size={13} className="shrink-0 text-lime-500" />
                        <span className="min-w-0 flex-1 truncate font-bold">
                          {shownName.display}
                        </span>
                        {badge && (
                          <span
                            className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-black ${badge.cls}`}
                          >
                            {badge.text}
                          </span>
                        )}
                        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                          {shownPlace.display || copy.noLocation}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        <FeedbackNote copy={copy} />

        <CrossSell current={slice} filtered={filtered} copy={copy} locale={locale} />

        <FaqSection slice={slice} count={count} copy={copy} refresh={refresh} />
      </div>

      {/* JSON-LD ItemList — 목록에 실제 팝업(행사)을 담는다. 경위는 eventListElements 주석. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: heading,
            description: intro,
            url: mainHref,
            numberOfItems: count,
            itemListElement: eventListElements(
              sorted.map((s) => s.m),
              locale,
            ),
          }),
        }}
      />
    </main>
  );
}

export default async function PopupsBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SliceLandingPage slug={slug} locale="ko" />;
}

/* ============================== 보조 컴포넌트 ============================== */

function StatCard({
  label,
  value,
  big = false,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  big?: boolean;
  tone?: 'neutral' | 'lime' | 'hot';
}) {
  const valueColor =
    tone === 'hot'
      ? 'text-orange-500'
      : tone === 'lime'
        ? 'text-lime-600 dark:text-lime-300'
        : 'text-foreground';
  return (
    <div
      className={`flex-1 rounded-2xl border p-3 md:p-4 text-center ${
        big
          ? 'border-lime-300/60 bg-lime-50 dark:bg-lime-300/[0.06]'
          : 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5'
      }`}
    >
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-black leading-tight ${big ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'} ${valueColor}`}
      >
        {value}
      </div>
    </div>
  );
}

function SliceIcon({ kind }: { kind: Slice['kind'] }) {
  const cls = 'text-lime-500';
  if (kind === 'region') return <MapPin size={16} className={cls} />;
  // region-period 는 시점이 구별 축이라 달력 쪽이 맞다.
  if (kind === 'period' || kind === 'region-period' || kind === 'category-period')
    return <Calendar size={16} className={cls} />;
  return <Tag size={16} className={cls} />;
}

/**
 * 정정 창구 — 검색으로 들어온 사람이 "찾던 게 없다 / 정보가 틀렸다" 를 바로 알릴 수 있게.
 *
 * <p>이 페이지의 목록은 크롤러 자동 수집물이라 누락·오기가 생긴다. 그걸 가장 먼저 알아채는 사람이
 * 바로 그 키워드로 검색해 들어온 방문자인데, 지금까지 이 화면엔 알릴 방법이 없었다(푸터 링크뿐).
 *
 * <p>새 폼을 만들지 않고 기존 {@code /feedback} 페이지로 보낸다 — 게스트도 그대로 작성 가능.
 * 목록 아래·회유 링크 위에 둬서 지도 CTA(전환 본선)와 경쟁하지 않게 하고, 스타일도 CrossSell 칩과
 * 같은 아웃라인 계열로 낮춘다. {@code prefetch=false} 인 이유는 대부분의 방문자가 누르지 않는
 * 링크를 랜딩 160여 개에서 미리 받아올 이유가 없어서다(/feedback 은 noindex 라 SEO 영향도 없다).
 */
function FeedbackNote({ copy }: { copy: LandingCopy }) {
  return (
    <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 md:px-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold md:text-base">
            <MessageSquare size={15} className="shrink-0 text-lime-500" />
            {copy.feedbackHeading}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">{copy.feedbackNote}</p>
        </div>
        <Link
          href="/feedback"
          prefetch={false}
          className="inline-flex shrink-0 items-center justify-center rounded-pill border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-900 transition hover:border-lime-300 hover:bg-lime-50 md:text-sm dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-lime-300/40 dark:hover:bg-lime-300/10"
        >
          {copy.feedbackCta}
        </Link>
      </div>
    </section>
  );
}

/**
 * 회유 동선 — 밋밋한 태그 클라우드를 '지금 찾는 팝업'으로 승격.
 * (1) 고의도 칩(오늘 오픈 / 주말 마감임박) (2) 브랜드 랜딩이면 매칭 팝업의 상위 지역 칩
 * (3) 브랜드/IP 우선 + 지역·시점·카테고리 전체 링크(SEO 내부링크 밀도 유지).
 */
function CrossSell({
  current,
  filtered,
  copy,
  locale,
}: {
  current: Slice;
  filtered: Marker[];
  copy: LandingCopy;
  locale: Locale;
}) {
  const home = LOCALE_PATH[locale] === '/' ? '' : LOCALE_PATH[locale];
  const L = (d: { label: string; labelEn: string; labelJa: string }) => localizedLabel(d, locale);
  // 고의도 칩
  const intent: { href: string; label: string; icon: 'flame' | 'clock' }[] = [];
  // 자기 자신으로 가는 순환 링크만 빼고 항상 노출한다.
  // (이전엔 `openingToday > 0 ||` 가 앞에 붙어 있었는데, today 가 아닌 페이지에선 뒤 절이 이미 참이라
  //  카운트 절이 아무것도 결정하지 못했고, 정작 /popups/today 에선 자기 자신을 가리키는 칩이 떴다.)
  if (current.slug !== 'today')
    intent.push({ href: `${home}/popups/today`, label: copy.crossSellToday, icon: 'flame' });
  if (current.slug !== 'this-weekend')
    intent.push({
      href: `${home}/popups/this-weekend`,
      label: copy.crossSellClosing,
      icon: 'clock',
    });

  // 브랜드 랜딩은 지도 필터가 없어 → 매칭 팝업 상위 지역으로 좁히게 유도
  const regionChips =
    current.kind === 'brand'
      ? topRegionSlugs(filtered, 3)
          .map((s) => regionBySlug(s))
          .filter((r): r is NonNullable<typeof r> => !!r)
      : [];

  // v2.43 — 지금 보고 있는 지역의 시점 조합("성수 이번 주")을 함께 건다.
  //
  // sitemap 에만 있고 어디서도 링크되지 않는 페이지는 크롤러가 늦게·드물게 본다. 지역×시점은 이번에
  // 새로 생긴 65개라 진입 링크가 하나도 없었다. 전 조합을 다 걸면 목록이 65개 늘어 읽기 어려우므로,
  // 문맥이 맞는 것(=지금 지역)만 건다.
  const currentRegionSlug =
    current.kind === 'region'
      ? current.slug
      : current.kind === 'region-period' || current.kind === 'region-category'
        ? current.regionSlug
        : null;
  const regionPeriodLinks = currentRegionSlug
    ? getPeriods().map((p) => ({
        slug: `${currentRegionSlug}-${p.slug}`,
        label: `${L(p)} ${(() => {
          const rg = regionBySlug(currentRegionSlug);
          return rg ? L(rg) : '';
        })()}`.trim(),
        kind: 'region-period' as const,
      }))
    : [];

  // 카테고리 문맥에서는 같은 카테고리의 날짜 조합으로 바로 좁힐 수 있게 한다. 전 조합을 모든
  // 페이지에 뿌리지 않고 현재 문맥의 5개만 연결해 검색엔진과 사용자가 같은 탐색 구조를 보게 한다.
  const currentCategorySlug =
    current.kind === 'category'
      ? current.slug
      : current.kind === 'category-period' || current.kind === 'region-category'
        ? current.categorySlug
        : null;
  const categoryPeriodLinks = currentCategorySlug
    ? getPeriods().map((p) => {
        const cat = categoryBySlug(currentCategorySlug);
        const label = cat
          ? locale === 'ko'
            ? `${L(p)} ${L(cat)}`
            : locale === 'ja'
              ? `${L(p)}の${L(cat)}`
              : `${L(cat)} ${L(p)}`
          : L(p);
        return {
          slug: `${currentCategorySlug}-${p.slug}`,
          label,
          kind: 'category-period' as const,
        };
      })
    : [];

  // 전체 링크(SEO) — 브랜드/IP 먼저
  const links: { slug: string; label: string; kind: Slice['kind'] }[] = [
    ...regionPeriodLinks,
    ...categoryPeriodLinks,
    ...BRANDS.map((b) => ({ slug: b.slug, label: L(b), kind: 'brand' as const })),
    ...REGIONS.map((r) => ({ slug: r.slug, label: L(r), kind: 'region' as const })),
    ...getPeriods().map((p) => ({ slug: p.slug, label: L(p), kind: 'period' as const })),
    ...CATEGORIES.map((c) => ({ slug: c.slug, label: L(c), kind: 'category' as const })),
  ].filter((s) => s.slug !== current.slug);

  return (
    <nav
      aria-label={copy.crossSellOther}
      className="mt-10 pt-6 border-t border-gray-200 dark:border-white/10"
    >
      <h3 className="text-sm md:text-base font-bold mb-3">{copy.crossSellHeading}</h3>

      {(intent.length > 0 || regionChips.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {intent.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="inline-flex items-center gap-1.5 rounded-pill border border-lime-300/60 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-700 transition hover:bg-lime-100 dark:bg-lime-300/10 dark:text-lime-300 dark:hover:bg-lime-300/20"
            >
              {c.icon === 'flame' ? <Flame size={13} /> : <Clock size={13} />}
              {c.label}
            </Link>
          ))}
          {regionChips.map((r) => (
            <Link
              key={r.slug}
              href={`${home}/popups/${r.slug}`}
              className="inline-flex items-center gap-1.5 rounded-pill border border-lime-300/60 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-700 transition hover:bg-lime-100 dark:bg-lime-300/10 dark:text-lime-300 dark:hover:bg-lime-300/20"
            >
              <MapPin size={13} />
              {L(r)} {current.label}
            </Link>
          ))}
        </div>
      )}

      <ul className="flex flex-wrap gap-2">
        {links.map((s) => (
          <li key={`${s.kind}-${s.slug}`}>
            <Link
              href={`${home}/popups/${s.slug}`}
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

function FaqSection({
  slice,
  count,
  copy,
  refresh,
}: {
  slice: Slice;
  count: number;
  copy: LandingCopy;
  refresh: string;
}) {
  const faqs = [
    { q: copy.faqRefreshQ, a: copy.faqRefreshA(refresh) },
    // 삼항 사슬이던 것을 문안 쪽 Record 로 옮겼다 — 슬라이스 종류가 늘면 타입 검사가 알려준다.
    { q: copy.faqSliceQ(slice.label), a: copy.faqSliceA[slice.kind] },
    { q: copy.faqWishQ, a: copy.faqWishA(count) },
  ];

  return (
    <section className="mt-10 pt-6 border-t border-gray-200 dark:border-white/10">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {copy.faqHeading}
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
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </section>
  );
}
