import type { MetadataRoute } from 'next';

import { REGIONS, classifyRegion } from '@/lib/regions';
import {
  getPeriods,
  CATEGORIES,
  BRANDS,
  classifyCategory,
  matchesPeriod,
  isExpired,
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
 *   <li>팝업 상세 ({@code /popup/[id]}) 는 sitemap 에 넣지 않는다 — app/popup/[id]/layout.tsx 에서
 *       noindex 이기 때문이다(회원 채팅이 같은 URL 에 살아 약관 §14 를 지키려면 색인할 수 없다).
 *       noindex 페이지를 sitemap 에 올리면 크롤러에게 "와서 보라"와 "색인하지 마라"를 동시에
 *       말하는 셈이라 크롤 예산만 쓴다. 예전 주석은 이 배제를 §10-2 "검색 결과 재현" 조항으로
 *       설명했는데, 개별 팝업 URL 목록은 검색 결과 페이지의 재현이 아니라 근거가 맞지 않았다.
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
  name: string;
  location: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
};

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
    return markers.filter((m) => !isExpired(m.endDate, today));
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

  // 지역×카테고리 건수는 마커를 한 번만 순회해 집계한다(조합 77개 × 전체 마커 재순회를 피한다).
  // 키를 classify* 의 반환값(코드)으로 만들고 조회는 slug 로 하는 것은 page.tsx 의 filterBySlice 와
  // 같은 비교다 — 한쪽만 code/slug 로 바꾸면 판정이 어긋난다.
  const comboCounts = new Map<string, number>();
  for (const m of live) {
    const key = `${classifyRegion(m.location)}-${classifyCategory(m.category)}`;
    comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
  }

  // v2.43 — 지역×시점 조합. 시점은 카테고리와 달리 마커당 하나로 정해지지 않으므로(한 팝업이 오늘·이번
  // 주·이번 달에 동시에 걸린다) 시점별로 따로 센다.
  const periodComboCounts = new Map<string, number>();
  for (const m of live) {
    const region = classifyRegion(m.location);
    for (const p of getPeriods()) {
      if (!matchesPeriod(m.startDate, m.endDate, p.code, now)) continue;
      const key = `${region}-${p.slug}`;
      periodComboCounts.set(key, (periodComboCounts.get(key) ?? 0) + 1);
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
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // v2.43 — 지도 전용 문서. "팝업스토어 지도" 류 검색을 받는다(경위는 app/map/page.tsx).
    {
      url: `${SITE_URL}/map`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // v2.48 — 언어별 홈. 사이트맵에 없으면 검색엔진이 늦게 발견한다. hreflang 은 각 페이지가
    // 서로를 가리켜 이미 선언돼 있고(app/../localeRoutes.ts), 여기서는 존재를 알리는 역할이다.
    {
      url: `${SITE_URL}/en`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/ja`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // v2.21-S3 — Long-tail 슬라이스 랜딩 페이지
  //
  // 지역 / 시점 / 카테고리는 0곳이어도 뺄 이유가 없다. page.tsx 가 noindex 를 붙이는 대상은
  // region-category 와 brand 두 종류뿐이라, 여기서 더 걸러내면 색인 가능한 URL 을 제 손으로
  // 버리는 셈이 된다. 제외 기준은 page.tsx 와 정확히 같은 범위여야 한다.
  const sliceLandings: MetadataRoute.Sitemap = [
    ...REGIONS.map((r) => ({
      url: `${SITE_URL}/popups/${r.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...getPeriods().map((p) => ({
      url: `${SITE_URL}/popups/${p.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}/popups/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    // 브랜드·IP·장소 랜딩 ("스텔라이브 팝업" 등). 매칭 0곳이면 페이지가 noindex 라 여기서도 뺀다.
    ...BRANDS.filter((b) => brandHasMatch(b.keywords)).map((b) => ({
      url: `${SITE_URL}/popups/${b.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    // v2.29 — 지역×카테고리 조합 롱테일 랜딩 ("성수 패션" 등, 큐레이션 집계라 §10-2 준수).
    // 브랜드와 같은 이유로 0곳 조합은 제외(/popups/mapo-tech 처럼 대부분이 여기서 나왔다).
    ...REGIONS.flatMap((r) =>
      CATEGORIES.filter((c) => (comboCounts.get(`${r.slug}-${c.slug}`) ?? 0) > 0).map((c) => ({
        url: `${SITE_URL}/popups/${r.slug}-${c.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ),
    // v2.43 — 지역×시점 조합 ("이번주 성수 팝업"). 네이버 서치어드바이저 검색어 1위가 이 형태인데
    // 받을 페이지가 없었다(this-week 와 seongsu 가 따로 있을 뿐 조합이 없었다). 0곳 조합은 위와 같은
    // 이유로 제외 — 페이지 자체가 noindex 다. 시점은 매일 바뀌므로 daily.
    ...REGIONS.flatMap((r) =>
      getPeriods()
        .filter((p) => (periodComboCounts.get(`${r.slug}-${p.slug}`) ?? 0) > 0)
        .map((p) => ({
          url: `${SITE_URL}/popups/${r.slug}-${p.slug}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.6,
        })),
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

  return [...staticPages, ...sliceLandings, ...localized];
}
