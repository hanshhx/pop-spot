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

/** THEMES 의 하드코딩 값 중 globals.css 토큰과 1:1 대응하는 것만 실제 토큰으로 치환. */
function resolveTheme(mode: MapMode): Theme {
  const t = THEMES[mode];
  return {
    ...t,
    earth: cssToken(mode === 'dark' ? '--color-ink-900' : '--color-cream-100', t.earth),
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
 * pmtiles 소스 URL. same-origin 프록시(/basemap)를 통해 받는다.
 * version(빌드 날짜)을 붙이면 서버가 그 빌드로 고정 → 브라우저가 타일을 immutable 캐시(속도 ↑).
 */
export function basemapTileUrl(version?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const q = version ? `?v=${encodeURIComponent(version)}` : '';
  return `pmtiles://${origin}/basemap${q}`;
}

/** 현재 서빙 중인 베이스맵 빌드 버전을 가져온다(타일 캐시 키). 실패 시 undefined(폴백). */
export async function fetchBasemapVersion(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  try {
    const r = await fetch(`${window.location.origin}/basemap/version`);
    if (!r.ok) return undefined;
    const j = (await r.json()) as { v?: string | null };
    return typeof j.v === 'string' ? j.v : undefined;
  } catch {
    return undefined;
  }
}
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';
