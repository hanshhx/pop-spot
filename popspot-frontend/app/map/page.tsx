import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

import MapClient from './MapClient';
import { REGIONS, classifyRegion } from '@/lib/regions';
import { getPeriods, matchesPeriod, isOpenNow, kstTodayStart } from '@/lib/popupSlices';
import type { Locale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import type { PublicMapMarker } from '@/lib/mapMarkers';

/**
 * /map — 서울 팝업스토어 지도.
 *
 * <p>v2.43 — 네이버 검색어에 "성수 팝업스토어 지도" · "케이스티파이 지도" 처럼 지도를 콕 집어
 * 찾는 질의가 잡히는데 받을 페이지가 없었다. 지도는 홈의 탭({@code /?tab=MAP})이라 주소가 따로
 * 없고, 검색엔진에는 홈 한 장으로만 보인다.
 *
 * <p>지역마다 {@code /popups/seongsu-map} 같은 걸 만들지 않은 이유: 그 페이지의 목록은
 * {@code /popups/seongsu} 와 <b>완전히 같아진다</b>. 지역×카테고리·지역×시점 조합은 거르는 결과가
 * 실제로 달라 별개 문서지만, "지도" 는 같은 목록을 보는 방식일 뿐이라 중복 문서가 된다. 검색엔진이
 * 중복으로 판정하면 원래 페이지 순위까지 깎인다. 그래서 지도를 <b>실제로 넣은</b> 문서 하나만 두고,
 * "{지역} 팝업스토어 지도" 는 기존 지역 랜딩이 받게 한다(app/popups/[slug]/page.tsx 의 description).
 *
 * <p>지도는 브라우저에서만 도는 MapLibre 라 MapClient 로 분리했다. 이 파일은 서버 컴포넌트로 남아
 * 제목·건수·지역 링크가 완성된 HTML 로 나간다 — 검색로봇이 JS 없이 읽을 본문이 있어야 한다.
 */

const SITE_URL = 'https://popspot.co.kr';
const PAGE_URL = `${SITE_URL}/map`;

const TITLE = '서울 팝업스토어 지도';
const DESCRIPTION =
  '서울 팝업스토어 위치를 지도 한 화면에서. 오늘 · 이번 주 팝업 일정과 성수 · 홍대 · 강남 등 지역별 위치, 마감일을 가입 없이 확인.';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `${TITLE} · POP-SPOT`,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

/**
 * 진행 중인 마커.
 *
 * <p>URL·fetch 옵션을 sitemap.ts / feed.xml / popups/[slug] 와 맞춰 빌드 내 데이터 캐시를 공유한다.
 *
 * <p>실패해도 빌드를 세우지 않는다 — 이 페이지의 본체는 지도(클라이언트에서 따로 마커를 받는다)이고,
 * 서버에서 쓰는 건 지역별 건수뿐이라 없으면 숫자만 빠진다. 랜딩({@code /popups/[slug]})과 달리
 * 데이터가 없다고 빈 페이지가 되지는 않는다.
 */
async function liveMarkers(): Promise<PublicMapMarker[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    console.error(`[map] NEXT_PUBLIC_API_URL 이 없거나 형식이 잘못되었습니다 — 건수 없이 렌더.`);
    return [];
  }
  try {
    const res = await fetch(`${apiBase}/api/map/markers`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: unknown = await res.json();
    if (!Array.isArray(body)) throw new Error('invalid marker response');
    const markers = body.filter(
      (value): value is PublicMapMarker =>
        !!value &&
        typeof value === 'object' &&
        typeof (value as Partial<PublicMapMarker>).id === 'number' &&
        typeof (value as Partial<PublicMapMarker>).name === 'string',
    );
    // v2.44 — 지도에 실제로 찍히는 핀과 같은 기준(isOpenNow). 이 페이지가 "N곳" 이라고 써 놓고
    // 아래 지도에는 다른 수가 찍히면 안 된다.
    const today = kstTodayStart();
    return markers.filter((m) => isOpenNow(m.startDate, m.endDate, today));
  } catch (e) {
    console.error(
      `[map] 마커 fetch 실패(${e instanceof Error ? e.message : String(e)}) — 건수 없이 렌더.`,
    );
    return [];
  }
}

const MAP_COPY = {
  ko: {
    home: '메인으로',
    title: '서울 팝업스토어 지도',
    placeUnit: '곳',
    description:
      '서울에서 진행 중인 팝업스토어 위치와 오늘 · 이번 주 일정을 지도 한 화면에서 봅니다. 지도를 움직이면 그 지역의 팝업이 표시되고, 핀을 누르면 운영 기간과 마감일을 확인할 수 있습니다. 가입 없이 확인할 수 있습니다.',
    openToday: (count: number) => `오늘 문 여는 곳은 ${count}곳입니다.`,
    regions: '지역으로 좁혀 보기',
    popupSuffix: '팝업스토어',
    periods: '언제 갈지 정해 보기',
    save: '위시 등록하고 내 팝업 모아보기',
  },
  en: {
    home: 'Home',
    title: 'Seoul pop-up store map',
    placeUnit: 'places',
    description:
      'See pop-up stores currently running in Seoul on one map. Move the map to explore an area, then select a pin to check the dates and closing day. Free to use without signing in.',
    openToday: (count: number) => `${count} ${count === 1 ? 'place is' : 'places are'} open today.`,
    regions: 'Browse by area',
    popupSuffix: 'pop-up stores',
    periods: 'Choose when to visit',
    save: 'Save pop-ups to your list',
  },
  ja: {
    home: 'ホーム',
    title: 'ソウルのポップアップストア地図',
    placeUnit: '件',
    description:
      'ソウルで開催中のポップアップストアを一つの地図で確認できます。地図を動かして地域を探し、ピンを選ぶと開催期間と終了日を確認できます。ログインなしで無料です。',
    openToday: (count: number) => `本日営業している場所は${count}件です。`,
    regions: '地域から探す',
    popupSuffix: 'ポップアップストア',
    periods: '行く日から探す',
    save: '気になるポップアップを保存',
  },
} as const;

const localRegionLabel = (region: (typeof REGIONS)[number], locale: Locale) =>
  locale === 'en' ? region.labelEn : locale === 'ja' ? region.labelJa : region.label;

export async function MapPageForLocale({ locale = 'ko' }: { locale?: Locale }) {
  const copy = MAP_COPY[locale];
  const now = new Date();
  const live = await liveMarkers();

  const byRegion = new Map<string, number>();
  for (const m of live) {
    const r = classifyRegion(m.location);
    byRegion.set(r, (byRegion.get(r) ?? 0) + 1);
  }

  const openToday = live.filter((m) => matchesPeriod(m.startDate, m.endDate, 'today', now)).length;

  // 건수 많은 순. 0곳 지역은 링크해도 빈 목록이라 뺀다.
  const regionLinks = REGIONS.map((r) => ({ ...r, count: byRegion.get(r.code) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <Link
          href={localizedPath('/', locale)}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-lime-600 dark:hover:text-lime-300"
        >
          {copy.home}
        </Link>

        <div className="mb-2 flex items-center gap-2">
          <MapPin size={16} className="text-lime-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            MAP
          </span>
        </div>

        <h1 className="mb-3 text-2xl font-bold md:text-4xl">
          {copy.title}
          {live.length > 0 && ` · ${live.length} ${copy.placeUnit}`}
        </h1>
        <p className="mb-8 max-w-2xl text-sm text-muted-foreground md:text-base">
          {copy.description}
          {openToday > 0 && ` ${copy.openToday(openToday)}`}
        </p>

        <MapClient initialMarkers={live} />

        {regionLinks.length > 0 && (
          <section className="mt-10 border-t border-gray-200 pt-6 dark:border-white/10">
            <h2 className="mb-3 text-sm font-bold md:text-base">{copy.regions}</h2>
            <div className="flex flex-wrap gap-2">
              {regionLinks.map((r) => (
                <Link
                  key={r.slug}
                  href={localizedPath(`/popups/${r.slug}`, locale)}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 px-3 py-1.5 text-xs font-bold transition hover:border-lime-300 hover:bg-lime-50 dark:border-white/10 dark:hover:bg-lime-300/10"
                >
                  {localRegionLabel(r, locale)} {copy.popupSuffix}
                  <span className="text-muted-foreground">{r.count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 border-t border-gray-200 pt-6 dark:border-white/10">
          <h2 className="mb-3 text-sm font-bold md:text-base">{copy.periods}</h2>
          <div className="flex flex-wrap gap-2">
            {getPeriods().map((p) => (
              <Link
                key={p.slug}
                href={localizedPath(`/popups/${p.slug}`, locale)}
                className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 px-3 py-1.5 text-xs font-bold transition hover:border-lime-300 hover:bg-lime-50 dark:border-white/10 dark:hover:bg-lime-300/10"
              >
                {locale === 'en' ? p.labelEn : locale === 'ja' ? p.labelJa : p.label}
              </Link>
            ))}
          </div>
        </section>

        <Link
          href={localizedPath('/?tab=MAP', locale)}
          className="mt-8 inline-flex items-center gap-2 rounded-pill bg-lime-300 px-5 py-3 text-sm font-bold text-ink-900 transition hover:bg-lime-400"
        >
          {copy.save} <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}

export default async function MapPage() {
  return <MapPageForLocale locale="ko" />;
}
