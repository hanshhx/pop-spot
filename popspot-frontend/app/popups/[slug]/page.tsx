import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, MapPin, Calendar, Tag, Clock, Flame, Footprints } from 'lucide-react';

import LocaleSwitcher from '@/components/LocaleSwitcher';
import DeferredInteractiveMap from '@/components/Map/DeferredInteractiveMap';
import { landingSeason } from '@/lib/landingSeason';
import { landingStatus, type LandingStatus } from '@/lib/landingStatus';
import { mappable } from '@/lib/mappable';
import type { PublicMapMarker } from '@/lib/mapMarkers';
import { REGIONS, classifyRegion, regionBySlug } from '@/lib/regions';
import { LANDING_COPY, type LandingCopy, type MetaPick, type PickReason } from '@/lib/landingCopy';
import { localizedLabel } from '@/lib/localeLabel';
import { PRIORITY_LANDING_LINKS } from '@/lib/priorityLandingLinks';
import { bilingual } from '@/lib/bilingual';
import type { Locale } from '@/lib/i18n';
import { LOCALE_PATH, slugAlternates } from '@/lib/localeRoutes';
import { localizedPath } from '@/lib/localePath';
import { CRAWL_REFRESH_BY_LOCALE } from '@/lib/siteCopy';
import { searchLandingTitle } from '@/lib/searchLandingTitle';
import { groupSameEvent } from '@/lib/groupSameEvent';
import { walkGroups } from '@/lib/walkGroups';
import { isProvenOutsideSeoul, seoulCameraBounds } from '@/lib/seoulGuard';
import { loadPublicMarkers } from '@/lib/emergencyPopupData';
import { CalendarButton } from '@/features/landing/CalendarButton';
import { FeedbackNoteCard } from '@/features/feedback/FeedbackNoteCard';
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
 * (BrowseSection) 이 이미 상세로 링크하고 있어서, 랜딩만 막아둘 이유가 없었다. 상세 색인은 §14-4에
 * 따라 종료일과 찾을 수 있는 장소가 검증된 진행 중 팝업에만 허용한다. 불확실한 상세는 계속 noindex다.
 * 회원 채팅·후기 같은 회원 콘텐츠는 상세의 검색용 본문과 분리해 색인 근거로 사용하지 않는다.
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
  /**
   * 지오코딩 결과. API 는 계속 내려주고 있었는데 이 타입이 안 받아서 안 쓰고 있었다.
   *
   * <p>주소 문자열보다 믿을 만한 유일한 값이다 — location 은 수집 단계가 앞에 "서울" 을 붙여
   * 놓아서, 대전·판교인 것도 "서울 ○○" 로 적혀 있다.
   */
  latitude?: string | null;
  longitude?: string | null;
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

/**
 * 정상 응답·Next 성공 캐시를 먼저 쓰고, 둘 다 없을 때만 검증된 공개 스냅샷을 쓴다.
 * 백엔드 장애 중 새 배포를 해도 SEO 랜딩이 0곳으로 다시 생성되지 않는다.
 */
async function fetchMarkers(): Promise<Marker[]> {
  const { markers } = await loadPublicMarkers(3600);
  return markers;
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

/**
 * 걸어서 묶기용 좌표 변환.
 *
 * <p>{@code latitude}/{@code longitude} 는 {@code PublicMapMarker} 처럼 문자열이거나 없다.
 * {@code Number(null)} 은 조용히 0 이 되고 {@code Number(' ')} 도 공백을 잘라내고 0 이 되는데,
 * {@code Number.isFinite(0)} 은 둘 다 참이다 — null 이든 공백뿐인 문자열이든 그대로
 * {@code Number()} 에 넣으면 좌표 없는 팝업이 적도·아프리카 서해안(0, 0)으로 떨어져 다른 깨진
 * 행과 한 묶음이 된다. 그래서 변환 전에 trim 한 뒤 null/빈 문자열을 먼저 걸러 낸다.
 */
function markerCoord(m: Marker): { lat: number; lng: number } | null {
  const lat = m.latitude?.trim();
  const lng = m.longitude?.trim();
  if (!lat || !lng) return null;
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : null;
}

/**
 * {@link mappable} 이 받는 {@code PublicMapMarker[]} 로 좁힌다.
 *
 * <p>이 페이지의 {@code Marker} 는 {@code latitude}/{@code longitude} 가 선택 필드(있을 수도,
 * 없을 수도)인데 {@code PublicMapMarker} 는 두 필드가 <b>필수</b>다(값 자체는 null 이어도 된다).
 * HomeClient 의 {@code popupToMapMarker} 와 같은 이유로, 값 판정은 여기서 하지 않고 없는 필드만
 * {@code null} 로 채운다 — 좌표가 있는지 없는지는 {@code mappable} 이 다시 본다.
 */
function toPublicMapMarkers(markers: Marker[]): PublicMapMarker[] {
  return markers.map((m) => ({
    ...m,
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
  }));
}

/** 상태 → 배지(문구·색). 종료·상시는 무배지. */
function ddayBadge(status: LandingStatus, copy: LandingCopy): { text: string; cls: string } | null {
  // 아직 안 연 것에 '진행 중' 을 달던 자리다. 색도 라임(가도 된다)이 아니라 중립으로 둔다.
  if (status.kind === 'upcoming')
    return {
      text: copy.ddayOpensIn(status.opensIn),
      cls: 'bg-gray-200 text-gray-700',
    };
  if (status.kind === 'ended') return null;
  const dday = status.dday;
  if (dday === null) return null;
  if (dday === 0) return { text: copy.ddayToday, cls: 'bg-red-500 text-white' };
  if (dday === 1) return { text: copy.ddayTomorrow, cls: 'bg-red-500 text-white' };
  // 'D-3' 표기는 한국에서만 통한다. 영어권은 '3d', 일본은 'あと3日' 로 읽는다.
  if (dday <= 3) return { text: copy.ddayValue(dday), cls: 'bg-orange-500 text-white' };
  if (dday <= 7) return { text: copy.ddayValue(dday), cls: 'bg-amber-400 text-ink-900' };
  return { text: copy.ddayOngoing, cls: 'bg-lime-300 text-ink-900' };
}

function formatPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  locale: Locale,
): string {
  const parseParts = (value: string | null | undefined) => {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match
      ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
      : null;
  };
  const start = parseParts(startDate);
  const end = parseParts(endDate);
  const format = (date: NonNullable<typeof start>) => {
    if (locale === 'en') {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
        new Date(Date.UTC(date.year, date.month - 1, date.day)),
      );
    }
    return locale === 'ja' ? `${date.month}月${date.day}日` : `${date.month}월 ${date.day}일`;
  };

  if (start && end && startDate === endDate) {
    return locale === 'en'
      ? `${format(start)} only`
      : locale === 'ja'
        ? `${format(start)}のみ`
        : `${format(start)} 하루`;
  }
  if (start && end) return `${format(start)} ~ ${format(end)}`;
  if (start) return locale === 'en' ? `From ${format(start)}` : `${format(start)}부터`;
  if (end) return locale === 'en' ? `Until ${format(end)}` : `${format(end)}까지`;
  return '';
}

// nearestDeadline 은 지웠다. 검색 결과 설명이 건수+최단마감("156곳 진행 중. 가장 빠른 마감 8/4")
// 에서 실제 이름("무기와라 팝업스토어(~8/4 잠실 롯데월드몰) 외 148곳")으로 바뀌면서, 첫 항목이 곧
// 최단 마감이라 문구가 겹쳤다. 설명은 80자쯤에서 잘리므로 겹치는 문장에 자리를 쓰지 않는다.

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
  // <b>지명은 번역본을 쓰지 않는다.</b> 이름과 언어가 섞여 보기 싫지만, 틀린 곳을 알려주는 것보다는
  // 낫다 — "대전신세계" 가 "Daegwallyeong"(강원 대관령) 으로 저장된 건이 운영에 실제로 있고,
  // 저장된 지명 번역 273건 중 절반가량이 지금 코드로는 만들 수 없는 값이다.
  //
  // 게다가 이 값이 들어가는 곳은 검색 결과 설명이다. 외국인이 그걸 보고 택시에서 보여줄 값이라면
  // 원문이라야 통한다. 번역된 지명은 지도 앱에도 안 나오고 직원에게 말해도 안 통한다.
  const text = m.location || '';
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
): { m: Marker; reason: PickReason; status: LandingStatus }[] {
  const picked: { m: Marker; reason: PickReason; status: LandingStatus }[] = [];
  const used = new Set<number>();
  const take = (m: Marker | undefined, reason: PickReason) => {
    if (!m || used.has(m.id)) return;
    used.add(m.id);
    picked.push({ m, reason, status: landingStatus(m.startDate, m.endDate, today) });
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

/**
 * 목록에 실제로 그릴 최대 개수.
 *
 * <p><b>왜 30 에서 60 으로 올렸나.</b> 2026-08-05 실측 — 60개 페이지가 제목에 적은 수보다 적게
 * 보여 주고 있었고, 가려진 자리가 합계 5,848개였다. {@code /popups/the-hyundai} 는 "50곳" 이라
 * 적고 32개만 그렸다.
 *
 * <p>가려진 팝업의 이름은 <b>HTML 에 아예 없다.</b> 그러면 "더현대 스파이더맨 팝업" 같은 긴 검색어를
 * 이 페이지가 받을 수 없고, 찾던 것이 안 보인 사람은 되돌아 나간다.
 *
 * <p><b>왜 전부는 아닌가.</b> 항목 하나가 마크업 약 549바이트다. {@code /popups/this-month} 는
 * 610곳이라 다 그리면 RSC 페이로드까지 670KB 가 넘는다. 60이면 the-hyundai(50)·브랜드 페이지
 * 대부분을 덮으면서 무게는 13% 만 는다.
 *
 * <p>이 값은 <b>세 곳이 함께 본다</b> — 잘라내는 곳, "N곳 더 있어요" 를 계산하는 곳, 그 문구를
 * 띄울지 정하는 곳. 예전엔 30 이 세 군데 흩어져 있어 한 곳만 고치면 숫자가 어긋났다.
 */
const LIST_LIMIT = 60;

/**
 * "곧 열리는 팝업" 섹션에 보여줄 최대 개수.
 *
 * <p>본문 목록(LIST_LIMIT=60)처럼 다 보여줄 필요가 없다 — 이 섹션은 본문 아래에 얹는 부차 정보라,
 * 길어지면 오히려 본문을 훑고 나가려는 사람을 여기서 또 붙잡는 꼴이 된다. "지금 고른다면"(3장,
 * 큐레이션)과 본문 목록(60, 전수) 사이 어딘가로, 한 화면에서 스크롤 없이 훑을 수 있는 선을 잡았다.
 */
const UPCOMING_LIMIT = 6;

/**
 * "걸어서 묶어 보기" 섹션에 보여줄 최대 묶음 수.
 *
 * <p>실측(스냅샷 709곳 좌표 보유, 15분 기준) — 묶음이 가장 큰 동네(성수동) 하나에서 96곳짜리
 * 묶음이 나온다. 동네가 실제로 그만큼 촘촘해서지 계산이 잘못된 게 아니다. 그렇다고 묶음을 다
 * 보여주면 이 보조 섹션이 본문 목록(LIST_LIMIT)보다 커진다. "지금 고른다면"(3장, 큐레이션)과
 * 같은 크기로 잡아, 결정 다음의 실행을 거들 뿐 본문을 밀어내지 않게 한다.
 */
const WALK_GROUP_LIMIT = 3;

/**
 * 한 묶음 안에서 실제로 나열할 최대 팝업 수.
 *
 * <p>위와 같은 실측에서 묶음 하나가 96곳까지 간다 — 다 나열하면 카드 하나가 본문 목록만큼
 * 길어진다. "곧 열리는 팝업"(UPCOMING_LIMIT=6)과 같은 선으로 잡아 스크롤 없이 훑을 수 있게
 * 하고, 넘는 수는 본문 목록 아래에 이미 쓰는 moreCount 문구를 그대로 재사용해 지도로 보낸다.
 */
const WALK_GROUP_MEMBER_LIMIT = 6;

/**
 * ItemList 에 담을 실제 팝업 이름.
 *
 * <p>Google Event 는 행사마다 고유한 상세 URL에서 그 행사 하나만 다뤄야 한다. 목록 페이지에서 여러
 * Event 를 선언하면 유효성 검사를 통과해도 안내 원칙과 맞지 않는다. 이 페이지는 목록이라는 사실만
 * ItemList 로 알리고, Event 는 날짜·장소가 검증되어 색인되는 {@code /popup/[id]} 에서만 선언한다.
 */
function itemListElements(markers: Marker[], locale: Locale) {
  return markers.slice(0, LIST_LIMIT).map((m, index) => {
    const name = bilingual(m.name, locale === 'en' ? m.nameEn : locale === 'ja' ? m.nameJa : null);
    return {
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Thing',
        name: name.display,
        ...(name.original ? { alternateName: name.original } : {}),
      },
    };
  });
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
  //
  // v2.54 — 지역×카테고리는 <b>건수와 무관하게</b> 색인하지 않는다. 위의 0곳 규칙과 달리
  // 이건 데이터가 비어서가 아니라 <b>그 형태의 검색이 오지 않아서</b>다.
  //
  // 실측(GSC 2026-05-21~07-31, 조합은 07-06 추가라 26일간 노출 기회가 있었다):
  //   60장 중 58장이 노출 0. 살아남은 2장의 노출 합계가 7, 클릭 1.
  //   같은 기간 지역 단독 12장은 노출 339, 카테고리 단독 6장은 노출 166 이었다.
  //
  // "얇아서 그렇다" 는 가설은 죽었다 — 팝업 6곳 이상 담긴 22장 중에도 20장이 노출 0 이다.
  // 축을 곱하면 URL 은 84개로 늘지만 검색 수요는 곱해지지 않는다.
  //
  // 최근에 만든 지역×시점(07-27)·카테고리×시점(08-02)은 <b>건드리지 않는다.</b> 위 데이터
  // 기간에 각각 5일·0일밖에 안 걸쳐서 노출 0 이 "죽음" 인지 "아직 안 자람" 인지 구분되지
  // 않는다. 지역×시점은 오히려 5일 만에 노출 76 을 냈다.
  let robots: Metadata['robots'] | undefined;
  if (count === 0 || slice.kind === 'region-category') {
    robots = { index: false, follow: true };
  }

  // 제목에는 건수만. 앞머리 키워드("니케 팝업스토어")를 건드리지 않도록 뒤에 붙인다 — 검색 결과에서
  // 숫자는 클릭을 끌지만 제목 앞부분은 순위에 쓰이므로 순서를 바꾸지 않는다.
  const base = copy.titles[slice.kind](slice.label);
  const title =
    searchLandingTitle({
      locale,
      kind: slice.kind,
      slug: slice.slug,
      label: slice.label,
      count,
    }) ?? (count > 0 ? copy.withCount(base, count) : base);

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
  const keywordLabel =
    locale === 'ko' && slice.kind === 'brand' && slice.slug === 'offside'
      ? '오프사이드 스토어'
      : slice.label.replace(/\s*\([^)]*\)/g, '').trim();
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
    .map((m) => ({
      m,
      dday: ddayOf(m.endDate, todayStart),
      status: landingStatus(m.startDate, m.endDate, todayStart),
    }))
    .sort((a, b) => rank(a.dday) - rank(b.dday));
  // 정렬했으므로 맨 앞이 곧 최소값. (Infinity = 유효한 마감일이 하나도 없음)
  const soonest = sorted.length > 0 ? rank(sorted[0].dday) : Infinity;
  const minDday = Number.isFinite(soonest) ? soonest : null;

  const topPicks = nowPicks(filtered, todayStart);

  /**
   * 지도 — "지금 고른다면" 다음, "걸어서 묶어 보기" 바로 위. {@code filtered} 전체(목록이 자르는
   * LIST_LIMIT 이전 값)를 넣는다. 지도는 이름을 나열하지 않고 위치만 찍으므로, 61번째 이후 팝업도
   * 좌표가 있으면 찍힌다 — "N곳 중 M곳" 의 N 이 실제 총 건수({@code count})와 같아야 하기 때문이다.
   */
  const mapMarkers = mappable(toPublicMapMarkers(filtered));
  /**
   * {@code InteractiveMap} 은 {@code initialMarkers} 만 받으면 마커에 맞춰 스스로 카메라를 옮기지
   * 않는다(고정된 성수 시작 위치·줌 그대로) — {@code fitBounds} 를 받아야 그 사각형이 다 보이도록
   * 맞춘다(줌 포함). 예전엔 좌표 평균(중심점)만 넘겼는데, 지도는 그 중심으로 <b>이동</b>만 하고
   * 줌은 고정 값(≈2km 반경)이었다 — 성수는 우연히 다 들어왔지만 this-week 처럼 서울 전역에
   * 흩어진 슬라이스는 "488곳 중 406곳 표시" 라고 적어놓고 대부분이 화면 밖(빈 한강)이었다.
   */
  const mapBounds = seoulCameraBounds(mapMarkers.shown);

  /**
   * 걸어서 묶기 — "지금 고른다면" 다음, 본문 목록 위에 놓는 실행 단계 정보.
   *
   * <p>이 섹션은 <b>이 목록을 걸어서 묶은 것</b>이다 — 그래서 입력을 {@code sorted} 전체가 아니라
   * 목록이 실제로 그리는 {@code sorted.slice(0, LIST_LIMIT)} 로 좁힌다. 전체를 넣으면 목록에
   * 안 보이는 60위 밖의 팝업이 좌표만 있으면 묶여서 이름이 뜰 수 있다 — 읽는 사람이 스크롤해
   * 내려가도 그 이름을 못 찾는 오류가 된다. 지금은 성수·이번달·강남·잠실·홍대 다섯 곳 모두 묶이는
   * 팝업이 상위 60위 안에서만 나와 우연히 안 터졌을 뿐, 근거 없이 우연에 기대지 않는다.
   *
   * <p>같은 풀 안에서 {@code sorted}(마감임박순) 순서를 그대로 입력 순서로 써서, 묶음의
   * anchor(각 묶음의 첫 항목)가 그 안에서 가장 급한 팝업이 되게 한다 — "이거 보러 가는 김에
   * 걸어서 갈 수 있는 곳" 이라는 맥락이 화면 설명 없이도 순서만으로 선다. 좌표 없는 팝업은
   * {@link markerCoord} 가 null 을 돌려줘 {@code walkGroups} 가 알아서 뺀다 — 본문 목록
   * (sorted/filtered) 은 이 결과와 무관하게 그대로 전부 그린다.
   */
  const walkClusters = walkGroups(
    sorted.slice(0, LIST_LIMIT).map((s) => s.m),
    markerCoord,
  ).slice(0, WALK_GROUP_LIMIT);

  /**
   * 곧 열리는 팝업 — sorted 에서 status 만 다시 걸러 쓴다. 두 번째 시계를 만들지 않는다: 여기 쓰는
   * status 는 위 sorted 를 만들 때 이미 todayStart 하나로 계산해 둔 값이다.
   *
   * <p><b>여는 날 오름차순.</b> 본문 목록은 마감(D-day) 기준이지만, 아직 열지도 않은 팝업에게
   * 마감 기준은 의미가 없다. 이 섹션이 답하는 질문은 "언제 갈 수 있나" 지 "언제 닫나" 가 아니다.
   */
  const upcoming = sorted
    .filter(
      (s): s is typeof s & { status: Extract<LandingStatus, { kind: 'upcoming' }> } =>
        s.status.kind === 'upcoming',
    )
    .sort((a, b) => a.status.opensIn - b.status.opensIn)
    .slice(0, UPCOMING_LIMIT);

  // 0곳일 때 대신 보여 줄 것 — 지금 열려 있는 아무 팝업이나 마감 임박순으로.
  //
  // 진행 중인 곳이 없는 슬러그에도 검색으로 사람이 들어온다(원신 11명 등). 그 사람에게
  // "없습니다" 만 주고 돌려보낼 이유가 없다. 같은 분류에서 못 찾으면 서울 전체에서 고른다.
  const alternatives =
    count === 0
      ? [...(await liveMarkers())]
          .map((m) => ({
            m,
            dday: ddayOf(m.endDate, todayStart),
            status: landingStatus(m.startDate, m.endDate, todayStart),
          }))
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
    /*
     * 이 랜딩만 다른 계절을 입는다 — <html> 의 계절을 여기서 덮어쓴다.
     *
     * 앱은 "지금" 이 곧 계절이지만 랜딩은 아니다. /popups/12월-성수 를 8월에 여는 사람이 매일
     * 있고, 그때 지금 계절로 칠하면 겨울 팝업 목록이 여름 하늘색으로 나온다. 규칙은
     * lib/landingSeason 참고.
     *
     * globals.css 의 계절 블록에 :root 없는 짝이 있어서 이 중첩이 먹는다. 그 짝을 지우면 이
     * 속성은 조용히 무시되고, 랜딩은 아무 표시 없이 오늘 계절로 돌아간다.
     */
    <main
      data-season={landingSeason(slug)}
      className="seo-landing-surface relative isolate min-h-screen overflow-x-clip pb-24 text-gray-900 md:pb-0 dark:text-white"
    >
      {/* 확정안 1d: 장식은 제목 주변에서만 끝나고 목록 아래는 조용한 종이 면으로 남긴다. */}
      <div aria-hidden="true" className="seo-landing-glow" />
      <div aria-hidden="true" className="seo-landing-grain" />

      <div className="relative z-10 mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-14">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href={home}
            /*
             * 페이지 맨 위 되돌아가기. 글자 높이(16px)만큼밖에 안 돼 손가락으로 누르기 어려웠다.
             * 글자 크기는 두고 위아래 여백으로 누를 면적만 넓힌다.
             */
            className="inline-flex min-h-11 items-center gap-1.5 py-2 text-xs text-muted-foreground transition hover:text-foreground md:text-sm"
          >
            <ArrowLeft size={14} /> {copy.backHome}
          </Link>
          <Suspense fallback={<span aria-hidden="true" className="h-11 w-[72px] shrink-0" />}>
            <LocaleSwitcher locale={locale} className="shrink-0" />
          </Suspense>
        </div>

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

        <p className="mb-5 max-w-2xl text-sm text-gray-600 md:text-base dark:text-white/70">
          {count > 0 ? subcopy : intro}
        </p>

        <div aria-hidden="true" className="seo-landing-hairline mb-5" />

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
            <section className="mb-8 rounded-2xl border border-lime-300/50 bg-white p-5 shadow-lg shadow-black/5 dark:bg-[#17181c] dark:shadow-black/30 md:p-6">
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
              <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#17181c] dark:shadow-black/30 md:p-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold md:text-xl">
                  <Flame size={16} className="text-lime-500" /> {copy.pickHeading}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {topPicks.map(({ m, reason, status }) => {
                    const badge = ddayBadge(status, copy);
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
                        {/* 사람을 다시 부르는 유일한 장치. 알림을 우리가 아니라 사용자 폰이
                            쏘므로 운영 부담이 0 이다. 날짜가 온전하지 않으면 안 그린다. */}
                        <CalendarButton
                          input={{
                            id: m.id,
                            name: m.name,
                            address: m.location,
                            startDate: m.startDate,
                            endDate: m.endDate,
                          }}
                          label={copy.calendarCta}
                        />
                      </li>
                    );
                  })}
                </ul>
                {/* 무엇을 기준으로 골랐는지 밝힌다. 안 밝히면 광고로 읽힌다. */}
                <p className="mt-3 text-xs text-muted-foreground">{copy.pickNote}</p>
              </section>
            )}

            {/* 지도 — "걸어서 묶어 보기" 바로 위. 읽는 순서가 "여기 모여 있다 → 걸어서 묶으면
                이렇다" 로 이어진다. 첫 화면이 아니므로 LCP 를 잡지 않는다 — DeferredInteractiveMap
                이 이 섹션이 스크롤로 들어오기 전에는 지도 번들도 pmtiles 타일도 받지 않는다.
                좌표가 있는 팝업만 찍는다(mappable) — 못 찍는 나머지는 지우지 않고 본문 목록에
                그대로 남는다. 찍을 것이 하나도 없으면 섹션 자체를 그리지 않는다(빈 지도는 서울
                전체를 보여주는 사진일 뿐 아무것도 답하지 않는다). 무게는 걸어서 묶기·곧 열리는
                팝업과 같은 h3/text-sm 다 — 본문을 돕는 보조 섹션이라 h2/text-lg 를 쓰지 않는다. */}
            {mapMarkers.shown.length > 0 && (
              <section className="mb-6 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#17181c] dark:shadow-black/30 md:px-6 md:py-5">
                <h3 className="flex items-center gap-2 text-sm font-bold md:text-base">
                  <MapPin size={15} className="shrink-0 text-lime-500" />
                  {copy.mapHeading}
                </h3>
                <div className="mt-3 h-[280px] overflow-hidden rounded-xl md:h-[380px]">
                  <DeferredInteractiveMap initialMarkers={mapMarkers.shown} fitBounds={mapBounds} />
                </div>
                {/* 개수 문구는 지도 아래. 지도를 먼저 보고 나서 "다 있는 건 아니구나" 를 읽는
                    순서가, 문구를 먼저 읽고 지도를 보는 것보다 자연스럽다. */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {copy.mapShownOf(mapMarkers.shown.length, mapMarkers.total)}
                </p>
              </section>
            )}

            {/* 걸어서 묶기 — "고른다면"(위) 다음의 실행 단계라 본문 목록 위에 둔다. 다만 내용은
                가볍다: 묶이면 좋은 보조 정보일 뿐 고르는 근거가 아니고, 좌표가 없으면 아예 안
                묶이므로 항상 뜨는 것도 아니다. 그래서 목록·"고른다면"과 같은 h2/text-lg 가 아니라
                "곧 열리는 팝업"과 같은 h3/text-sm 로 가볍게 얹는다. 묶음이 하나도 없으면 그리지
                않는다. */}
            {walkClusters.length > 0 && (
              <section className="mb-6 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#17181c] dark:shadow-black/30 md:px-6 md:py-5">
                <h3 className="flex items-center gap-2 text-sm font-bold md:text-base">
                  <Footprints size={15} className="shrink-0 text-lime-500" />
                  {copy.walkHeading}
                </h3>
                <div className="mt-3 space-y-4">
                  {walkClusters.map((group) => {
                    // members[0] 이 anchor 다(walkGroups 의 정의). 목록 맨 앞에 그대로 두어,
                    // "여기서부터 N분" 이라는 뜻을 문구를 늘리지 않고 순서로만 전달한다.
                    const anchorId = group.members[0].id;
                    const shown = group.members.slice(0, WALK_GROUP_MEMBER_LIMIT);
                    const restCount = group.members.length - shown.length;
                    return (
                      <div key={anchorId}>
                        <span className="inline-flex items-center rounded-pill bg-black/5 px-2 py-0.5 text-[11px] font-black text-muted-foreground dark:bg-white/10">
                          {copy.walkGroupLabel(group.minutes)}
                        </span>
                        <ul className="mt-2 space-y-2">
                          {shown.map((m) => {
                            const shownName = bilingual(
                              m.name,
                              locale === 'en' ? m.nameEn : locale === 'ja' ? m.nameJa : null,
                            );
                            return (
                              <li key={m.id} className="relative flex items-center gap-2 text-sm">
                                <Link
                                  href={localizedPath(`/popup/${m.id}`, locale)}
                                  aria-label={copy.detailAria(shownName.display ?? m.name)}
                                  className="absolute inset-0 z-10 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
                                />
                                <MapPin size={13} className="shrink-0 text-gray-400" />
                                <span className="min-w-0 flex-1 truncate font-bold">
                                  {shownName.display}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        {restCount > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {copy.moreCount(restCount)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 목록 — 마감임박순 + D-day 배지 (기존 기간 재포맷) */}
            <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#17181c] dark:shadow-black/30 md:p-8">
              <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-orange-500" /> {copy.listHeading}
              </h2>
              <ul className="space-y-3">
                {sorted.slice(0, LIST_LIMIT).map(({ m, status }) => {
                  const badge = ddayBadge(status, copy);
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
                          {/* 좌표가 서울 밖이면 밝힌다. 목록에서 빼지 않는 이유는, 찾아온
                              사람에게는 그 팝업이 존재한다는 사실 자체가 정보이기 때문이다.
                              대신 "서울" 이라고 적힌 주소를 그대로 믿지 않게 표시한다. */}
                          {isProvenOutsideSeoul(m) && (
                            <span className="shrink-0 rounded-pill bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/25 dark:text-amber-400">
                              {copy.outsideSeoulBadge}
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
                            {formatPeriod(m.startDate, m.endDate, locale)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > LIST_LIMIT && (
                <p className="text-xs text-muted-foreground mt-3">
                  {copy.moreCount(filtered.length - LIST_LIMIT)}
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
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#17181c] dark:shadow-black/30 md:p-8">
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
                  {alternatives.map(({ m, status }) => {
                    const badge = ddayBadge(status, copy);
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

        {/* 곧 열리는 팝업 — 본문 목록 아래, 정정 창구 위. 본문(위)이 이 페이지의 본선이라 그 앞을
            가로막지 않는다. count===0 과 무관하게 독립 조건(upcoming.length > 0)으로 그린다 —
            지금은 upcoming 이 sorted 의 부분집합이라 count===0 이면 upcoming 도 항상 0 이 되지만
            (그 반대 경로는 지금 코드로는 열리지 않는다), 이 배치는 그 우연에 기대지 않는다.
            alternatives 처럼 upcoming 도 나중에 슬라이스 밖까지 보는 폴백을 갖게 되면 count 와
            무관해질 수 있어서, 처음부터 두 블록 중 어느 쪽이 떴는지와 상관없이 독립적으로 판단해
            둔다. 한 건도 없으면 섹션 자체를 그리지 않는다 — 빈 제목만 남기지 않는다. */}
        {upcoming.length > 0 && (
          <section className="mt-10 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#17181c] dark:shadow-black/30 md:px-6 md:py-5">
            <h3 className="flex items-center gap-2 text-sm font-bold md:text-base">
              <Calendar size={15} className="shrink-0 text-gray-400" />
              {copy.upcomingHeading}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">{copy.upcomingNote}</p>
            <ul className="mt-3 space-y-2">
              {upcoming.map(({ m, status }) => {
                const badge = ddayBadge(status, copy);
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
                    <MapPin size={13} className="shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate font-bold">{shownName.display}</span>
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
          </section>
        )}

        <FeedbackNote copy={copy} />

        <CrossSell current={slice} filtered={filtered} copy={copy} locale={locale} />

        <FaqSection slice={slice} count={count} copy={copy} refresh={refresh} />
      </div>

      {count > 0 && (
        <div className="seo-landing-sticky-cta fixed inset-x-0 bottom-0 z-40 px-3 pt-7 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="mx-auto max-w-md">
            <Link
              href={mapHref}
              className="flex min-h-14 items-center justify-center rounded-2xl border border-ink-900/10 bg-lime-300 px-5 text-sm font-black text-ink-900 shadow-2xl active:scale-[0.99]"
            >
              {locale === 'ko'
                ? `지도에서 ${count}곳 보기`
                : locale === 'ja'
                  ? `地図で${count}件見る`
                  : `See ${count} on the map`}
            </Link>
          </div>
        </div>
      )}

      {/* 목록은 ItemList, 개별 행사의 Event는 검증된 상세 URL에서만 선언한다. */}
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
            itemListElement: itemListElements(
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
          ? 'border-lime-300/60 bg-lime-50 dark:bg-lime-300/[0.08]'
          : 'border-gray-200 bg-white dark:border-white/10 dark:bg-[#17181c]'
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
 * 정정 창구 — 검색으로 들어온 사람이 "찾던 게 없다 / 정보가 틀렸다" 를 그 자리에서 바로 알릴 수 있게.
 *
 * <p>이 페이지의 목록은 크롤러 자동 수집물이라 누락·오기가 생긴다. 그걸 가장 먼저 알아채는 사람이
 * 바로 그 키워드로 검색해 들어온 방문자인데, 전에는 {@code /feedback} 으로 내보내는 링크뿐이었다
 * — 이 함수는 그 자리를 채우는 실제 폼({@code FeedbackNoteCard}, {@code 'use client'})으로 언어별
 * 문안({@code copy})만 문자열로 넘기는 얇은 다리다. 폼 자체가 {@code useLocale()} 을 쓰므로 렌더
 * 위치가 {@code LocaleProvider} 안이어야 하는데, 루트 레이아웃이 앱 전체를 감싸고 {@code /en}·
 * {@code /ja} 는 그 안에 한 겹 더(초기 로케일 고정) 감싸 항상 안쪽이다.
 */
function FeedbackNote({ copy }: { copy: LandingCopy }) {
  return (
    <FeedbackNoteCard
      heading={copy.feedbackHeading}
      note={copy.feedbackNote}
      cta={copy.feedbackCta}
    />
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
    ...PRIORITY_LANDING_LINKS.map((item) => ({
      slug: item.slug,
      label: L(item),
      kind: item.kind,
    })),
    ...regionPeriodLinks,
    ...categoryPeriodLinks,
    ...BRANDS.map((b) => ({ slug: b.slug, label: L(b), kind: 'brand' as const })),
    ...REGIONS.map((r) => ({ slug: r.slug, label: L(r), kind: 'region' as const })),
    ...getPeriods().map((p) => ({ slug: p.slug, label: L(p), kind: 'period' as const })),
    ...CATEGORIES.map((c) => ({ slug: c.slug, label: L(c), kind: 'category' as const })),
  ]
    .filter((s) => s.slug !== current.slug)
    .filter(
      (item, index, all) => all.findIndex((candidate) => candidate.slug === item.slug) === index,
    );

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
              className="inline-flex items-center gap-1.5 rounded-pill border border-lime-300/60 bg-lime-50 min-h-9 px-3 py-2 text-xs font-bold text-lime-700 transition hover:bg-lime-100 dark:bg-lime-300/10 dark:text-lime-300 dark:hover:bg-lime-300/20"
            >
              {c.icon === 'flame' ? <Flame size={13} /> : <Clock size={13} />}
              {c.label}
            </Link>
          ))}
          {regionChips.map((r) => (
            <Link
              key={r.slug}
              href={`${home}/popups/${r.slug}`}
              className="inline-flex items-center gap-1.5 rounded-pill border border-lime-300/60 bg-lime-50 min-h-9 px-3 py-2 text-xs font-bold text-lime-700 transition hover:bg-lime-100 dark:bg-lime-300/10 dark:text-lime-300 dark:hover:bg-lime-300/20"
            >
              <MapPin size={13} />
              {L(r)} {current.label}
            </Link>
          ))}
        </div>
      )}

      <ul className="flex flex-wrap gap-2">
        {links.slice(0, 12).map((s) => (
          <li key={`${s.kind}-${s.slug}`}>
            <Link
              href={`${home}/popups/${s.slug}`}
              className="inline-flex items-center min-h-9 px-3 py-2 rounded-pill text-xs font-medium border bg-white text-gray-900 border-gray-200 hover:border-lime-300 hover:bg-lime-50 dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-lime-300/10 dark:hover:border-lime-300/40 transition"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
      {links.length > 12 && (
        <details className="group mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-pill border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold transition hover:border-lime-300 dark:border-white/10 dark:bg-white/5">
            {locale === 'ko'
              ? '관련 지역·주제 더 보기'
              : locale === 'ja'
                ? '関連項目をもっと見る'
                : 'Show more related pages'}
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {links.slice(12).map((s) => (
              <li key={`${s.kind}-${s.slug}`}>
                <Link
                  href={`${home}/popups/${s.slug}`}
                  className="inline-flex min-h-9 items-center rounded-pill border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:border-lime-300 hover:bg-lime-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-lime-300/40 dark:hover:bg-lime-300/10"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
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
          __html: jsonLd({
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
