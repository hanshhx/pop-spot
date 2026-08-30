/**
 * popspot 지도 베이스 스타일 (MapLibre + Protomaps).
 *
 * 카카오맵의 알록달록한 래스터 타일 대신, 팝스팟 브랜드 팔레트(라임/보라/잉크/크림)를
 * 그대로 입힌 벡터 스타일. 팝업 핀은 이 스타일이 아니라 React HTML 오버레이로 그린다
 * (기존 CustomOverlayMap 카드 UI 를 100% 유지하기 위함).
 *
 * 데이터: OpenStreetMap © / Protomaps basemap v4 스키마.
 * 레이어명(earth/water/roads/places/pois...)은 실제 pmtiles 메타데이터에서 확인한 값.
 *
 * ⚠️ 한글: Protomaps 기본 폰트에는 한글 글리프가 없다. 지명이 두부(□)로 뜨지 않도록
 *    Map 생성 시 localIdeographFontFamily 로 로컬 폰트(=브랜드 폰트)를 쓴다. (MapGL.tsx)
 */

import { mix } from '@/lib/colorMix';
import { API_BASE_URL } from '@/lib/env';

export type MapMode = 'dark' | 'light';

interface Theme {
  earth: string;
  park: string;
  water: string;
  building: string;
  roadMinor: string;
  roadMedium: string;
  roadMajor: string;
  roadHighway: string;
  boundary: string;
  label: string;
  labelHalo: string;
  labelSmall: string;
  rail: string;
  subway: string;
}

const THEMES: Record<MapMode, Theme> = {
  dark: {
    earth: '#0a0a0a', // ink-900
    park: '#16240a',
    water: '#0d0a20', // 한강을 브랜드 보라 계열로
    building: '#151515',
    roadMinor: '#1c1c1c',
    roadMedium: '#282828',
    roadMajor: '#343434',
    roadHighway: '#454545',
    boundary: '#2e2e2e',
    label: '#c9c9c9',
    labelHalo: '#0a0a0a',
    labelSmall: '#7a7a7a',
    rail: '#2c2c3c',
    subway: '#7b61ff', // violet-400 — 팝업(라임)과 안 겹치는 기준점 색
  },
  light: {
    earth: '#fbf9f3', // cream-100
    park: '#e9f5d5',
    water: '#e6e3f7',
    building: '#f0ede3',
    roadMinor: '#ffffff',
    roadMedium: '#ffffff',
    roadMajor: '#ffffff',
    roadHighway: '#fff3d0',
    boundary: '#ddd9cb',
    label: '#232323',
    labelHalo: '#fbf9f3',
    labelSmall: '#8a8a8a',
    rail: '#cfcbbd',
    subway: '#5e3fee',
  },
};

/**
 * globals.css 의 브랜드 토큰을 실제로 읽어온다(없으면 fallback).
 *
 * <p>THEMES 에 hex 를 손으로 적어두면 팔레트를 바꿨을 때 UI 크롬만 바뀌고 지도는 옛 색으로 남아
 * 화면이 어긋난다. buildBaseStyle 은 브라우저에서만 호출되므로 CSS 변수를 직접 참조할 수 있다.
 */
function cssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * 계절이 닿지 않는 색들의 기준점.
 *
 * <p>물과 공원은 <b>제 색을 지켜야 한다.</b> 계절색으로 그대로 칠하면 가을에 주황색 한강이
 * 흐른다 — 계절보다 "저건 강" 이라는 인식이 먼저다. 그래서 파랑·초록이라는 기준만 여기 두고,
 * 실제 색은 지도 바탕(earth)을 섞어 만든다. 섞는 순간 계절 색온도가 옮겨붙어, 제 색을 지키면서도
 * 같은 화면에 속한 것으로 보인다.
 *
 * <p>핀·클러스터의 라임은 여기 없다 — 그건 DOM 오버레이라 {@code bg-lime-300} 클래스를 쓰고,
 * 계절 라임 스케일이 이미 갈아끼워져 자동으로 따라온다.
 */
interface Anchors {
  /** 도로가 향하는 쪽. 지도 관습상 도로는 <b>두 모드 모두</b> 바탕보다 밝다. */
  road: string;
  /** 건물·철도가 향하는 쪽. 바탕에서 멀어지는 방향이라 다크는 밝게, 라이트는 어둡게. */
  mass: string;
  water: string;
  park: string;
  /** 고속도로. 다른 도로보다 한 단 밝고 따뜻해야 한 눈에 갈린다. */
  highway: string;
  /** 글자. */
  ink: string;
}

const ANCHORS: Record<MapMode, Anchors> = {
  dark: {
    road: '#ffffff',
    mass: '#ffffff',
    water: '#12314f',
    park: '#1d3a1c',
    highway: '#f2e3bb',
    ink: '#ffffff',
  },
  light: {
    road: '#ffffff',
    mass: '#0a0a0a',
    water: '#b9d6e8',
    park: '#cbe4b2',
    highway: '#ffe6a8',
    ink: '#0a0a0a',
  },
};

/** 바탕에서 각 면이 얼마나 떨어져 있는지. 0 이면 바탕과 같은 색이다. */
const STEPS: Record<
  MapMode,
  Record<keyof typeof SURFACE_ANCHOR | 'label' | 'labelSmall', number>
> = {
  dark: {
    building: 0.055,
    roadMinor: 0.08,
    roadMedium: 0.135,
    roadMajor: 0.19,
    roadHighway: 0.34,
    rail: 0.145,
    water: 0.5,
    park: 0.42,
    label: 0.8,
    labelSmall: 0.46,
  },
  light: {
    building: 0.05,
    // 라이트 지도의 도로는 흰색이다. 굵기로 위계를 만들고 색은 하나로 둔다 — 흰 선이
    // 이어질 때 '길' 로 읽히지, 세 단계 회색으로 나누면 얼룩처럼 보인다.
    roadMinor: 1,
    roadMedium: 1,
    roadMajor: 1,
    roadHighway: 0.62,
    rail: 0.24,
    water: 0.55,
    park: 0.5,
    label: 0.87,
    labelSmall: 0.5,
  },
};

/** 각 면이 어느 기준점을 향해 가는지. 도로·건물은 잉크/흰쪽(=밝기 층), 물·공원은 제 색으로. */
const SURFACE_ANCHOR = {
  building: 'mass',
  roadMinor: 'road',
  roadMedium: 'road',
  roadMajor: 'road',
  roadHighway: 'highway',
  rail: 'mass',
  water: 'water',
  park: 'park',
} as const;

/**
 * 팔레트가 실제로 따라야 할 모드.
 *
 * <p>색의 출처가 둘이라는 것이 문제다. {@code earth} 는 CSS 변수({@code --s-map})에서 오는데 그
 * 값은 {@code <html>} 의 {@code .dark} 클래스가 정하고, 나머지는 React 가 넘긴 {@code mode}
 * (next-themes 의 resolvedTheme)가 정한다. 둘이 한순간이라도 어긋나면 <b>검은 바탕에 연보라
 * 강물</b> 같은 반쪽짜리 지도가 나온다 — 한쪽은 다크, 한쪽은 라이트 팔레트인 상태다.
 *
 * <p>그래서 브라우저에서는 <b>변수를 읽는 그 문서에게 직접 묻는다.</b> 두 출처를 하나로 만들면
 * 어긋날 여지 자체가 없어진다. 서버에는 document 가 없으므로 넘겨받은 값을 그대로 쓴다.
 */
function documentMode(fallback: MapMode): MapMode {
  if (typeof document === 'undefined') return fallback;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * 지도 팔레트를 <b>계절 바탕색 하나에서</b> 만든다.
 *
 * <p>예전에는 14색 중 {@code earth} 와 {@code boundary} 둘만 계절을 따랐다. 나머지 열둘이 브랜드
 * 고정값이라, 여름(차가운 청록) 바탕 위에 보라색 강과 따뜻한 초록 공원이 얹혔다 — 한 화면에 두
 * 팔레트가 섞여 지도만 딴 서비스처럼 보였다.
 *
 * <p>계절마다 열두 색을 CSS 에 또 적는 방법도 있지만, 그러면 관리할 값이 여덟 계절 × 열둘로
 * 불어난다. 대신 바탕에서 계산한다. {@code --s-map} 하나만 바꾸면 도로·건물·물·공원·글자가
 * 전부 그 색온도로 따라오고, 팔레트를 손볼 때 볼 곳은 지금과 같은 한 줄이다.
 */
function resolveTheme(requested: MapMode): Theme {
  const mode = documentMode(requested);
  const t = THEMES[mode];
  const a = ANCHORS[mode];
  const step = STEPS[mode];

  const brandEarth = cssToken(mode === 'dark' ? '--color-ink-900' : '--color-cream-100', t.earth);
  const earth = cssToken('--s-map', brandEarth);
  const from = (key: keyof typeof SURFACE_ANCHOR) => mix(earth, a[SURFACE_ANCHOR[key]], step[key]);

  return {
    earth,
    building: from('building'),
    roadMinor: from('roadMinor'),
    roadMedium: from('roadMedium'),
    roadMajor: from('roadMajor'),
    roadHighway: from('roadHighway'),
    rail: from('rail'),
    water: from('water'),
    park: from('park'),

    // 경계선은 이미 계절 토큰이 따로 있다 — 바탕과의 거리를 계절마다 손으로 정해 둔 값이다.
    boundary: cssToken('--s-mapline', t.boundary),

    // 글자는 바탕에서 잉크 쪽으로. 후광이 바탕색이어야 글자가 지도 위에 얹힌 것으로 읽힌다.
    label: mix(earth, a.ink, step.label),
    labelSmall: mix(earth, a.ink, step.labelSmall),
    labelHalo: earth,

    /* 지하철만 계절 밖에 둔다. 이건 장식이 아니라 위치를 가늠하는 기준점이라 사계절 내내 같은
       색이어야 하고, 계절 라임(=팝업 핀)과 겹치지 않는 것이 유일한 조건이다. */
    subway: cssToken(mode === 'dark' ? '--color-violet-400' : '--color-violet-500', t.subway),
  };
}

const SRC = 'protomaps';
// 한글 우선(name:ko), 없으면 name(OSM 기본이 이미 한글인 경우 많음)
const NAME_KO: ExpressionSpecification = ['coalesce', ['get', 'name:ko'], ['get', 'name']];
// 지하철역 이름은 OSM 에 '역' 없이 들어있다("성수"). 이미 '역'이면 그대로.
const STATION_LABEL: ExpressionSpecification = [
  'case',
  ['==', ['slice', ['coalesce', ['get', 'name:ko'], ['get', 'name'], ''], -1], '역'],
  ['coalesce', ['get', 'name:ko'], ['get', 'name'], ''],
  ['concat', ['coalesce', ['get', 'name:ko'], ['get', 'name'], ''], '역'],
];
const SHOP_KINDS = [
  'restaurant',
  'cafe',
  'convenience',
  'bar',
  'bakery',
  'beauty',
  'pub',
  'fast_food',
  'clothes',
  'bank',
];

/**
 * 완성된 MapLibre 스타일 스펙을 만든다.
 *
 * @param mode        다크/라이트
 * @param tileUrl     pmtiles 소스 URL. 예: `pmtiles://https://호스트/api/basemap`
 * @param showShops   주변 상점 라벨 표시 여부(기본 false — 팝업 핀이 주인공).
 */
export function buildBaseStyle(
  mode: MapMode,
  tileUrl: string,
  showShops = false,
): StyleSpecification {
  const t = resolveTheme(mode);
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      [SRC]: {
        type: 'vector',
        url: tileUrl,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Protomaps',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': t.earth } },
      {
        id: 'earth',
        type: 'fill',
        source: SRC,
        'source-layer': 'earth',
        paint: { 'fill-color': t.earth },
      },
      {
        id: 'landuse-green',
        type: 'fill',
        source: SRC,
        'source-layer': 'landuse',
        filter: [
          'match',
          ['get', 'kind'],
          [
            'park',
            'forest',
            'wood',
            'grass',
            'recreation_ground',
            'golf_course',
            'cemetery',
            'zoo',
            'farmland',
            'scrub',
            'grassland',
            'garden',
          ],
          true,
          false,
        ],
        paint: { 'fill-color': t.park },
      },
      {
        id: 'water',
        type: 'fill',
        source: SRC,
        'source-layer': 'water',
        paint: { 'fill-color': t.water },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: SRC,
        'source-layer': 'buildings',
        minzoom: 13,
        paint: {
          'fill-color': t.building,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1],
        },
      },
      {
        id: 'roads-minor',
        type: 'line',
        source: SRC,
        'source-layer': 'roads',
        filter: ['match', ['get', 'kind'], ['minor_road', 'path', 'other'], true, false],
        minzoom: 12,
        paint: {
          'line-color': t.roadMinor,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.4, 15, 2, 18, 8],
        },
      },
      {
        id: 'roads-medium',
        type: 'line',
        source: SRC,
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'medium_road'],
        paint: {
          'line-color': t.roadMedium,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 0.6, 15, 4, 18, 14],
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: SRC,
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'major_road'],
        paint: {
          'line-color': t.roadMajor,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 0.7, 15, 5, 18, 18],
        },
      },
      {
        id: 'roads-highway',
        type: 'line',
        source: SRC,
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'highway'],
        paint: {
          'line-color': t.roadHighway,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 6, 0.8, 15, 6, 18, 22],
        },
      },
      {
        id: 'rail',
        type: 'line',
        source: SRC,
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'rail'],
        minzoom: 11,
        paint: {
          'line-color': t.rail,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 3],
          'line-dasharray': [3, 1.5],
        },
      },
      {
        id: 'boundaries',
        type: 'line',
        source: SRC,
        'source-layer': 'boundaries',
        paint: { 'line-color': t.boundary, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'place-neighbourhood',
        type: 'symbol',
        source: SRC,
        'source-layer': 'places',
        filter: ['match', ['get', 'kind'], ['neighbourhood', 'macrohood'], true, false],
        minzoom: 12,
        layout: {
          'text-field': NAME_KO,
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-max-width': 8,
        },
        paint: {
          'text-color': t.labelSmall,
          'text-halo-color': t.labelHalo,
          'text-halo-width': 1.2,
        },
      },
      {
        id: 'place-locality',
        type: 'symbol',
        source: SRC,
        'source-layer': 'places',
        filter: ['match', ['get', 'kind'], ['locality', 'region', 'country'], true, false],
        layout: {
          'text-field': NAME_KO,
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 16],
          'text-max-width': 8,
        },
        paint: { 'text-color': t.label, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.6 },
      },
      {
        id: 'shops',
        type: 'symbol',
        source: SRC,
        'source-layer': 'pois',
        minzoom: 16,
        filter: ['match', ['get', 'kind'], SHOP_KINDS, true, false],
        layout: {
          visibility: showShops ? 'visible' : 'none',
          'text-field': NAME_KO,
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-max-width': 7,
          'text-optional': true,
        },
        paint: {
          'text-color': t.labelSmall,
          'text-halo-color': t.labelHalo,
          'text-halo-width': 1.2,
        },
      },
      {
        id: 'subway-dot',
        type: 'circle',
        source: SRC,
        'source-layer': 'pois',
        filter: ['==', ['get', 'kind'], 'station'],
        minzoom: 12,
        paint: {
          'circle-color': t.subway,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 5.5],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': t.labelHalo,
        },
      },
      {
        id: 'subway-label',
        type: 'symbol',
        source: SRC,
        'source-layer': 'pois',
        filter: ['==', ['get', 'kind'], 'station'],
        minzoom: 13,
        layout: {
          'text-field': STATION_LABEL,
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': t.subway, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.6 },
      },
    ],
  };
}

/**
 * 카카오 지도 level ↔ MapLibre zoom 변환.
 *
 * 카카오는 level 이 낮을수록 확대(level 1 = 최대 확대). MapLibre 는 zoom 이 높을수록 확대.
 * 기존 코드가 쓰던 level 값(홈=4, 상세=3)과 비슷한 화면이 나오도록 맞춘 근사식.
 */
export const zoomFromLevel = (level: number): number => 18 - level; // level 4 → 14, level 3 → 15

/**
 * pmtiles 소스 URL. 저장소에 동봉한 서울 추출본을 **CDN 에서 직접** 받는다.
 *
 * <p>예전엔 {@code /basemap} 서버 함수를 거쳤다. 그 함수는 남의 서버(build.protomaps.com)의 전 세계
 * 파일을 대신 읽어 주려고 만든 것이라, 우리 파일을 우리 CDN 에서 주는 지금은 거칠 이유가 없다.
 *
 * <p>실측(운영):
 *
 * <ul>
 *   <li>파일 직접(CDN): 0.036~0.050s
 *   <li>{@code /basemap} 함수 경유: 0.238~1.007s ← 함수 오버헤드로 200~950ms 추가
 * </ul>
 *
 * 타일은 화면 하나에 수십 개가 나가므로 이 차이가 그대로 체감 속도가 된다. 그래서 타일만 직행시킨다.
 *
 * <p>{@code ?v=} 는 파일 서명(ETag 해시)이라 파일을 갈아끼우면 값이 바뀐다 → 브라우저 캐시가 자동
 * 무효화된다. Vercel 정적 서빙은 쿼리를 무시하고 같은 파일을 주므로(실측: 쿼리 유무 모두 206) 안전하다.
 */
export function basemapTileUrl(version?: string): string {
  const q = version ? `?v=${encodeURIComponent(version)}` : '';
  return `pmtiles://${API_BASE_URL}/seoul.pmtiles${q}`;
}

/** 현재 서빙 중인 베이스맵 빌드 버전을 가져온다(타일 캐시 키). 실패 시 undefined(폴백). */
export async function fetchBasemapVersion(): Promise<string | undefined> {
  try {
    const r = await fetch(`${API_BASE_URL}/basemap/version`);
    if (!r.ok) return undefined;
    const j = (await r.json()) as { v?: string | null };
    return typeof j.v === 'string' ? j.v : undefined;
  } catch {
    return undefined;
  }
}
/*
 * 스타일 타입은 maplibre-gl(브라우저 전용) 대신 스펙 패키지에서 가져온다 — 앱에는 브라우저용
 * maplibre-gl 을 넣을 수 없고, 두 패키지의 타입은 같은 스펙에서 나온다. 그래서 이 파일의 나머지는
 * 웹과 한 글자도 다르지 않다.
 */
import type { ExpressionSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
