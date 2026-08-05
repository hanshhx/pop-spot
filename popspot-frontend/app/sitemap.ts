import type { MetadataRoute } from 'next';

import { REGIONS, classifyRegion } from '@/lib/regions';
import { isIndexableDetail } from '@/lib/indexableDetail';
import { TERMS_EFFECTIVE_DATE, kstToday } from './popup/[id]/serverData';
import {
  getPeriods,
  CATEGORIES,
  BRANDS,
  classifyCategory,
  matchesPeriod,
  isExpired,
  isStale,
  kstTodayStart,
} from '@/lib/popupSlices';

/**
 * Sitemap.xml 자동 생성 (Next.js {@code MetadataRoute.Sitemap}).
 *
 * <p>v2.15 — 네이버 / 구글 서치 콘솔에 등록할 sitemap. 정책상 안전한 정적 페이지만 포함.
 *
 * <p>v2.21-S3 — Long-tail SEO 랜딩 페이지 ({@code /popups/[slug]}) 자동 등록.
 * 지역 / 시점 / 카테고리 슬라이스 페이지가 모두 sitemap 에 포함되어 Naver / Google
 * 이 long-tail 키워드 ("성수동 팝업 추천" 등) 로 잡을 수 있게 한다.
 *
 * <ul>
 *   <li>팝업 상세 ({@code /popup/[id]}) 는 <b>자격을 갖춘 것만</b> 넣는다(2026-08-11 시행).
 *       판정은 layout.tsx 와 같은 함수({@code judgeIndexable})를 쓴다 — 사이트맵과 noindex 가
 *       어긋나면 크롤러에게 "와서 보라"와 "색인하지 마라"를 동시에 말하는 셈이라 크롤 예산만 쓴다.
 *       예전에는 전부 뺐고, 그 이유를 주석이 "회원 채팅이 같은 URL 에 살아서" 라고 적었는데
 *       <b>틀렸다</b> — 실제 근거는 §14-4 가 자동수집 상세 전체를 막고 있던 것이고, 회원 콘텐츠
 *       조항(§14-5)은 그와 별개다. §14-4 를 개정해 조건부 허용으로 바꿨고 §14-5 는 그대로다.
 *   <li>슬라이스 랜딩 페이지는 운영자가 직접 큐레이션한 분류 (지역 / 시점 / 카테고리) 라
 *       약관 §10-2 의 "검색 결과 재현" 에 해당하지 않음 (집계 / 분류만).
 *   <li>사용자 게시판 (동행 / 의견) 도 PII 보호를 위해 미포함.
 * </ul>
 *
 * <p>v2.42 — 결과 0곳인 슬라이스는 sitemap 에서 뺀다. 위의 "/popup/[id] 를 넣지 않는 이유" 가 여기에도
 * 그대로 적용되는데 지키지 못하고 있었다 — 브랜드·지역×카테고리 랜딩은 매칭 0곳이면 페이지가 noindex 인데
 * (app/popups/[slug]/page.tsx 의 generateMetadata) sitemap 은 조합을 조건 없이 전부 올렸다. 실측 166건 중
 * 53건(32%)이 noindex 였다 — 크롤 예산을 그만큼 버리고 서치 콘솔에 경고가 상시 뜬다.
 */
const SITE_URL = 'https://popspot.co.kr';

/** 건수 판정에 필요한 최소 필드. app/popups/[slug]/page.tsx 의 Marker 와 같은 응답. */
type Marker = {
  /** 상세 URL(/popup/{id}) 을 만들 때 쓴다. */
  id: number;
  name: string;
  location: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  /** 백엔드가 아는 실제 데이터 변경 시각. 이전 백엔드 응답에는 없을 수 있다. */
  lastModified?: string | null;
};

/**
 * 사이트맵 lastmod 는 빌드 시각이 아니라 페이지 내용이 실제로 달라진 시각이어야 한다.
 *
 * <p>백엔드 배포 전 응답에는 lastModified 가 없으므로 시작일을 보수적인 대체값으로 쓴다. 미래
 * 시작일은 미래 수정일이 아니므로 현재 시각까지만 인정한다.
 */
function markerModifiedAt(marker: Marker, now: Date): Date | null {
  for (const raw of [marker.lastModified, marker.startDate]) {
    if (!raw) continue;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) continue;
    return parsed.getTime() > now.getTime() ? now : parsed;
  }
  return null;
}

function latestModified(markers: Marker[], now: Date): Date | undefined {
  let latest = 0;
  for (const marker of markers) {
    const modified = markerModifiedAt(marker, now);
    if (modified && modified.getTime() > latest) latest = modified.getTime();
  }
  return latest > 0 ? new Date(latest) : undefined;
}

/**
 * 진행 중인 마커 — 색인 여부를 판정하는 원본 데이터.
 *
 * <p>URL·fetch 옵션을 app/popups/[slug]/page.tsx 와 <b>똑같이</b> 맞춘다. 같은 빌드 안에서 Next 데이터 캐시를
 * 공유해 백엔드를 두 번 부르지 않고, 무엇보다 sitemap 과 페이지가 <b>같은 스냅샷</b>을 보게 된다. 두 곳이 서로
 * 다른 시점의 데이터로 판정하면 지금 고치는 불일치(색인 대상인데 sitemap 에 없거나 그 반대)가 다시 생긴다.
 *
 * <p>실패 시 빈 배열. 빌드를 세우지 않는 이유는 page.tsx 가 같은 fetch 를 3회 재시도한 뒤 이미 빌드를 중단하기
 * 때문이다(ALLOW_EMPTY_SEO_BUILD 로 명시 허용했을 때만 통과). 그 탈출구를 켠 빌드에서는 page.tsx 도 빈 목록을
 * 보고 해당 랜딩을 전부 noindex 로 만들므로, 여기서도 같은 판정(=목록에서 제외)이 맞다. 반대로 실패 시 전부
 * 올려버리면 지금 고치는 문제를 그대로 재현한다.
 *
 * <p>{@code src/lib/env.ts} 대신 환경변수를 직접 읽는 것은 page.tsx 와 맞추기 위해서다. env 모듈은 값이
 * 없을 때 운영 서버에서 throw 하므로, 그쪽을 쓰면 sitemap 이 빌드를 세우는 쪽으로 동작이 바뀐다. 두 파일의
 * 판정 기준을 같게 유지하는 것이 여기서는 더 중요하다.
 */
async function liveMarkers(): Promise<Marker[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    console.error(
      `[sitemap] NEXT_PUBLIC_API_URL 이 없거나 형식이 잘못되었습니다(값: ${apiBase ?? '미설정'}). ` +
        `결과 0곳 슬라이스를 걸러낼 수 없어 슬라이스 랜딩을 sitemap 에서 제외합니다.`,
    );
    return [];
  }

  try {
    const res = await fetch(`${apiBase}/api/map/markers`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const markers = (await res.json()) as Marker[];
    const today = kstTodayStart();
    // 만료 팝업 제외 — page.tsx 의 liveMarkers() 와 같은 기준(isExpired + kstTodayStart).
    return markers.filter(
      (m) => !isExpired(m.endDate, today) && !isStale(m.startDate, m.endDate, today),
    );
  } catch (e) {
    console.error(
      `[sitemap] 마커 fetch 실패(${e instanceof Error ? e.message : String(e)}) — ` +
        `noindex 판정을 못 하므로 브랜드·지역×카테고리 랜딩을 sitemap 에서 제외합니다.`,
    );
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const live = await liveMarkers();
  const liveLastModified = latestModified(live, now);

  // v2.43 — 지역×시점 조합. 시점은 카테고리와 달리 마커당 하나로 정해지지 않으므로(한 팝업이 오늘·이번
  // 주·이번 달에 동시에 걸린다) 시점별로 따로 센다.
  const periodComboCounts = new Map<string, number>();
  const categoryPeriodCounts = new Map<string, number>();
  for (const m of live) {
    const region = classifyRegion(m.location);
    const category = classifyCategory(m.category);
    for (const p of getPeriods()) {
      if (!matchesPeriod(m.startDate, m.endDate, p.code, now)) continue;
      const regionKey = `${region}-${p.slug}`;
      periodComboCounts.set(regionKey, (periodComboCounts.get(regionKey) ?? 0) + 1);
      const categoryKey = `${category}-${p.slug}`;
      categoryPeriodCounts.set(categoryKey, (categoryPeriodCounts.get(categoryKey) ?? 0) + 1);
    }
  }

  // 브랜드 매칭도 page.tsx 와 동일 — 이름+위치를 소문자로 합쳐 키워드 substring.
  const brandHasMatch = (keywords: string[]) => {
    const kws = keywords.map((k) => k.toLowerCase());
    return live.some((m) => {
      const hay = `${m.name ?? ''} ${m.location ?? ''}`.toLowerCase();
      return kws.some((k) => hay.includes(k));
    });
  };

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: liveLastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // v2.43 — 지도 전용 문서. "팝업스토어 지도" 류 검색을 받는다(경위는 app/map/page.tsx).
    {
      url: `${SITE_URL}/map`,
      lastModified: liveLastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // v2.48 — 언어별 홈. 사이트맵에 없으면 검색엔진이 늦게 발견한다. hreflang 은 각 페이지가
    // 서로를 가리켜 이미 선언돼 있고(app/../localeRoutes.ts), 여기서는 존재를 알리는 역할이다.
    {
      url: `${SITE_URL}/en`,
      lastModified: liveLastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/ja`,
      lastModified: liveLastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // v2.21-S3 — Long-tail 슬라이스 랜딩 페이지
  //
  // 제외 기준은 page.tsx 의 noindex 조건과 <b>정확히 같은 범위</b>여야 한다. 어긋나면 v2.42 사고가
  // 재발한다 — noindex 인 URL 을 sitemap 에 실어 보내 크롤 예산만 태웠다.
  //
  // 지금 걸러내는 것: region(0곳) · region-category(0곳) · region-period(0곳) · brand(0곳).
  // 시점·카테고리는 걸러내지 않는다 — 시점은 날짜가 바뀌면 저절로 채워지고 카테고리 7개는 상시
  // 0곳이 되지 않으므로, 여기서 빼면 색인 가능한 URL 을 제 손으로 버리는 셈이 된다.
  const regionCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const periodCounts = new Map<string, number>();
  for (const m of live) {
    const code = classifyRegion(m.location);
    regionCounts.set(code, (regionCounts.get(code) ?? 0) + 1);
    const category = classifyCategory(m.category);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    for (const period of getPeriods()) {
      if (!matchesPeriod(m.startDate, m.endDate, period.code, now)) continue;
      periodCounts.set(period.slug, (periodCounts.get(period.slug) ?? 0) + 1);
    }
  }

  const sliceLandings: MetadataRoute.Sitemap = [
    ...REGIONS.filter((r) => (regionCounts.get(r.code) ?? 0) > 0).map((r) => {
      const matched = live.filter((m) => classifyRegion(m.location) === r.code);
      return {
        url: `${SITE_URL}/popups/${r.slug}`,
        lastModified: latestModified(matched, now),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      };
    }),
    ...getPeriods()
      .filter((p) => (periodCounts.get(p.slug) ?? 0) > 0)
      .map((p) => {
        const matched = live.filter((m) => matchesPeriod(m.startDate, m.endDate, p.code, now));
        return {
          url: `${SITE_URL}/popups/${p.slug}`,
          lastModified: latestModified(matched, now),
          changeFrequency: 'daily' as const,
          priority: 0.6,
        };
      }),
    ...CATEGORIES.filter((c) => (categoryCounts.get(c.code) ?? 0) > 0).map((c) => {
      const matched = live.filter((m) => classifyCategory(m.category) === c.code);
      return {
        url: `${SITE_URL}/popups/${c.slug}`,
        lastModified: latestModified(matched, now),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      };
    }),
    // 브랜드·IP·장소 랜딩 ("스텔라이브 팝업" 등). 매칭 0곳이면 페이지가 noindex 라 여기서도 뺀다.
    ...BRANDS.filter((b) => brandHasMatch(b.keywords)).map((b) => {
      const kws = b.keywords.map((keyword) => keyword.toLowerCase());
      const matched = live.filter((m) => {
        const hay = `${m.name ?? ''} ${m.location ?? ''}`.toLowerCase();
        return kws.some((keyword) => hay.includes(keyword));
      });
      return {
        url: `${SITE_URL}/popups/${b.slug}`,
        lastModified: latestModified(matched, now),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      };
    }),
    // v2.29 에서 넣었던 지역×카테고리 조합("성수 패션" 등)은 v2.54 에서 <b>뺐다.</b>
    //
    // GSC 2026-05-21~07-31 실측 — 07-06 에 넣었으니 26일간 노출 기회가 있었는데
    // 60장 중 58장이 노출 0 이었다. 살아남은 2장을 합쳐도 노출 7 · 클릭 1 이다.
    // 같은 기간 지역 단독 12장은 노출 339, 카테고리 단독 6장은 노출 166 을 냈다.
    //
    // 담긴 팝업이 적어서가 아니다 — 6곳 이상 담긴 22장 중에도 20장이 노출 0 이다.
    // 그래서 "최소 N곳" 문턱으로는 고쳐지지 않고, 형태 자체를 뺀다.
    //
    // 지역×시점(07-27)·카테고리×시점(08-02)은 그대로 둔다. 위 데이터 기간에 5일·0일밖에
    // 안 걸쳐 있어 노출 0 이 죽음인지 아직 안 자란 것인지 구분되지 않는다.
    //
    // page.tsx 의 robots 판정도 같이 고쳤다. 한쪽만 고치면 v2.42 사고가 재발한다.
    // comboCounts 는 지역×카테고리 전용이었으므로 함께 지웠다.
    // 카테고리×시점 조합. 영어·일본어의 "K-beauty pop-ups this weekend"처럼 구매·방문 의도가
    // 분명한 검색을 받는다. 실제 결과가 있는 조합만 공개해 키워드만 바꾼 빈 페이지를 만들지 않는다.
    ...CATEGORIES.flatMap((c) =>
      getPeriods()
        .filter((p) => (categoryPeriodCounts.get(`${c.code}-${p.slug}`) ?? 0) > 0)
        .map((p) => {
          const matched = live.filter(
            (m) =>
              classifyCategory(m.category) === c.code &&
              matchesPeriod(m.startDate, m.endDate, p.code, now),
          );
          return {
            url: `${SITE_URL}/popups/${c.slug}-${p.slug}`,
            lastModified: latestModified(matched, now),
            changeFrequency: 'daily' as const,
            priority: 0.6,
          };
        }),
    ),
    // v2.43 — 지역×시점 조합 ("이번주 성수 팝업"). 네이버 서치어드바이저 검색어 1위가 이 형태인데
    // 받을 페이지가 없었다(this-week 와 seongsu 가 따로 있을 뿐 조합이 없었다). 0곳 조합은 위와 같은
    // 이유로 제외 — 페이지 자체가 noindex 다. 시점은 매일 바뀌므로 daily.
    ...REGIONS.flatMap((r) =>
      getPeriods()
        .filter((p) => (periodComboCounts.get(`${r.slug}-${p.slug}`) ?? 0) > 0)
        .map((p) => {
          const matched = live.filter(
            (m) =>
              classifyRegion(m.location) === r.code &&
              matchesPeriod(m.startDate, m.endDate, p.code, now),
          );
          return {
            url: `${SITE_URL}/popups/${r.slug}-${p.slug}`,
            lastModified: latestModified(matched, now),
            changeFrequency: 'daily' as const,
            priority: 0.6,
          };
        }),
    ),
  ];

  // v2.49 — 같은 슬러그의 영어·일본어 판을 함께 올린다.
  //
  // 색인 대상 판정(0곳이면 제외)을 여기서 다시 하지 않고 <b>위에서 만든 목록을 그대로 펼친다.</b>
  // 언어별로 따로 세면 판정이 세 벌이 되고, 한쪽만 고쳤을 때 어긋난다 — 이 파일이 v2.42 에서
  // 고쳤던 문제가 정확히 그것이었다. 세 언어는 같은 데이터를 보므로 건수도 같다.
  const localized = sliceLandings.flatMap((e) =>
    (['en', 'ja'] as const).map((loc) => ({
      ...e,
      url: e.url.replace(`${SITE_URL}/popups/`, `${SITE_URL}/${loc}/popups/`),
      // 번역판은 원본보다 낮게 둔다. 크롤 예산이 한정돼 있으면 한국어를 먼저 도는 편이 낫다.
      priority: Math.max(0.1, (e.priority ?? 0.5) - 0.1),
    })),
  );

  // 검색 가능한 정적 안내 페이지도 각 언어 주소를 직접 알린다. 로그인·의견·협업 화면은 noindex라 제외.
  const localizedStatic: MetadataRoute.Sitemap = (['en', 'ja'] as const).flatMap((locale) =>
    [
      { path: 'about', frequency: 'monthly' as const, priority: 0.7 },
      { path: 'map', frequency: 'daily' as const, priority: 0.8 },
      { path: 'terms', frequency: 'yearly' as const, priority: 0.2 },
      { path: 'privacy', frequency: 'yearly' as const, priority: 0.2 },
    ].map((page) => ({
      url: `${SITE_URL}/${locale}/${page.path}`,
      changeFrequency: page.frequency,
      priority: page.priority,
    })),
  );

  /**
   * 자격을 갖춘 팝업 상세.
   *
   * <p>약관 §14-4 개정(2026-08-11 시행)이 "운영 종료일과 찾아갈 수 있는 위치가 모두 확인된
   * 경우에 한해 색인을 허용" 한다고 공표했다. 시행 전에는 한 건도 넣지 않는다 — 그 전에 넣으면
   * 공표한 것보다 넓게 여는 것이다.
   *
   * <p>판정은 {@code app/popup/[id]/layout.tsx} 와 <b>같은 함수</b>({@code judgeIndexable})를
   * 쓴다. 사이트맵과 noindex 가 어긋나면 크롤러에게 "와서 보라" 와 "색인하지 마라" 를 동시에
   * 말하는 셈이라 크롤 예산만 쓴다 — v2.42 에 실제로 겪은 사고다.
   *
   * <p>실측으로 1,002건 중 448건(44.7%)이 통과한다. 나머지는 주소가 "서울" 한 줄뿐이거나
   * 종료일을 모르는 것들이라, 검색한 사람의 질문에 답할 수 없다.
   *
   * <p>en/ja 판은 넣지 않는다. 팝업 이름의 대부분이 한국어 원문 그대로라 같은 내용이 세 벌
   * 올라갈 뿐이다.
   */
  const today = kstToday();
  const detailPages: MetadataRoute.Sitemap =
    today < TERMS_EFFECTIVE_DATE
      ? []
      : live
          .filter((m) => isIndexableDetail(m, today))
          .map((m) => ({
            url: `${SITE_URL}/popup/${m.id}`,
            lastModified: latestModified([m], now),
            // 팝업은 기간이 끝나면 자격을 잃고 목록에서 빠진다. 매일 확인할 값어치가 있다.
            changeFrequency: 'daily' as const,
            // 랜딩(0.5~0.8)보다 낮게 둔다. 크롤 예산이 한정되면 목록을 먼저 도는 편이 낫다.
            priority: 0.4,
          }));

  return [...staticPages, ...localizedStatic, ...sliceLandings, ...localized, ...detailPages];
}
