'use client';

/**
 * MapLibre 어댑터 — 기존 react-kakao-maps-sdk 의 Map / CustomOverlayMap / Polyline 을
 * 최소 인터페이스로 대체한다. 목적: InteractiveMap 의 오버레이 UI(카테고리칩·사이드바·
 * 마커카드 등)를 한 줄도 안 바꾸고 지도 엔진만 카카오 → MapLibre 로 교체하기 위함.
 *
 * SSR 안전: maplibre-gl / pmtiles 는 window 에 의존하므로 절대 top-level import 하지 않고
 * useEffect 안에서 동적 import 한다. 자식(MapMarker/MapPolyline)은 로드된 라이브러리를
 * context 로 받아 쓴다.
 */

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Map, Marker, GeoJSONSource } from 'maplibre-gl';
import { buildBaseStyle, basemapTileUrl, fetchBasemapVersion, type MapMode } from './mapStyle';

type MapInstance = Map;
// 런타임 lib 값은 import('maplibre-gl').then((m) => m.default) 로 받는 default export 다.
// 소비처(MapMarker)는 lib.Marker 처럼 이름 있는 export 만 참조하므로, 모듈 네임스페이스
// 타입으로 두면 타입·런타임 모두 맞아 별도 캐스팅이 필요 없다.
type MapLib = typeof import('maplibre-gl');

interface Ctx {
  map: MapInstance | null;
  lib: MapLib | null;
}
const MapCtx = createContext<Ctx>({ map: null, lib: null });
export const useMapGL = () => useContext(MapCtx);

// pmtiles 프로토콜은 프로세스에 1번만 등록.
let protocolRegistered = false;

export interface LngLatLike {
  lat: number;
  lng: number;
}

interface MapGLProps {
  center: LngLatLike;
  zoom: number;
  mode?: MapMode;
  /** 지도 생성 완료 후 원본 maplibre Map 인스턴스를 넘긴다(패닝/줌 제어용). */
  onCreate?: (map: MapInstance) => void;
  /** 빈 지도(마커 아닌 곳) 클릭. 선택 해제 등에 사용. */
  onClick?: () => void;
  className?: string;
  id?: string;
  children?: ReactNode;
}

export function MapGL({
  center,
  zoom,
  mode = 'dark',
  onCreate,
  onClick,
  className,
  id,
  children,
}: MapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<Ctx>({ map: null, lib: null });
  // 현재 스타일에 실제로 적용된 mode. 불필요한 setStyle(깜빡임) 방지용.
  const appliedModeRef = useRef<MapMode | null>(null);
  // 버전이 붙은 타일 URL(캐시 가능). setStyle 시에도 재사용.
  const tileUrlRef = useRef<string>('');
  // 최신 콜백을 effect 재실행 없이 참조. 렌더 중 ref 를 쓰면 안 되므로(React 19) 커밋 후 갱신한다.
  const onCreateRef = useRef(onCreate);
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onCreateRef.current = onCreate;
    onClickRef.current = onClick;
  });

  useEffect(() => {
    let map: MapInstance | null = null;
    let cancelled = false;

    (async () => {
      // 라이브러리 import 와 타일 버전 조회를 병렬로.
      const [maplibregl, pmtiles, version] = await Promise.all([
        import('maplibre-gl').then((m) => m.default),
        import('pmtiles'),
        fetchBasemapVersion(),
      ]);
      if (cancelled || !containerRef.current) return;

      if (!protocolRegistered) {
        maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
        protocolRegistered = true;
      }

      const tileUrl = basemapTileUrl(version);
      tileUrlRef.current = tileUrl;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildBaseStyle(mode, tileUrl),
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
        // 한글 라벨을 로컬(브랜드) 폰트로 직접 렌더 — Protomaps 기본폰트엔 한글 글리프가 없음
        localIdeographFontFamily: "'Wanted Sans Variable','Pretendard',sans-serif",
        dragRotate: false,
        pitchWithRotate: false,
        // 타일을 메모리에 더 오래 유지 → 팬/줌 시 재요청 감소.
        maxTileCacheSize: 512,
        // 만료 타일 재검증 안 함(우린 버전으로 캐시 무효화 관리).
        refreshExpiredTiles: false,
      });
      appliedModeRef.current = mode; // 초기 스타일은 마운트 시점 mode 로 지음
      map.touchZoomRotate?.disableRotation?.();

      if (onClickRef.current) map.on('click', () => onClickRef.current?.());

      map.on('load', () => {
        // map 은 클로저에 잡힌 let 변수라 타입상 null 일 수 있다 — 가드로 좁혀
        // setCtx / onCreate 에 non-null 로 넘긴다(정리 시 cancelled 로도 이미 차단됨).
        if (cancelled || !map) return;
        setCtx({ map, lib: maplibregl });
        onCreateRef.current?.(map);
      });
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
    // 마운트 시 1회만 생성. center/zoom/mode 변경은 명령형 API 로 처리(아래).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mode(다크/라이트) 변경 시 스타일 교체.
  // ctx.map 을 deps 에 넣어, 지도 로드 전에 테마가 확정된 경우에도 로드 직후 반영되게 한다.
  // appliedModeRef 로 이미 적용된 mode 는 건너뛰어 불필요한 setStyle(깜빡임)을 막는다.
  // 마커는 DOM 오버레이라 setStyle 후에도 유지되고, dark: 클래스로 테마에 자동 반응한다.
  useEffect(() => {
    const m = ctx.map;
    if (!m) return;
    if (appliedModeRef.current === mode) return;
    appliedModeRef.current = mode;
    m.setStyle(buildBaseStyle(mode, tileUrlRef.current || basemapTileUrl()));
  }, [mode, ctx.map]);

  // center prop 이 실제로 바뀌면 지도를 그쪽으로 이동한다. 좌표가 갱신되는 소비자(예: DetailMap
  // 에서 팝업 A→B 이동)를 위해 필요. 값(위경도) 기준 비교라, 부모가 매 렌더 새 객체를 줘도
  // 같은 좌표면 무시한다. 고정 center 를 주고 이동을 자체 처리하는 InteractiveMap 에선 no-op.
  // deps 가 이미 원시값(lat/lng)이라 좌표가 실제로 바뀔 때만 재실행된다 — 별도 비교 ref 는 불필요.
  useEffect(() => {
    const m = ctx.map;
    if (!m) return;
    m.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [center.lat, center.lng, ctx.map]);

  return (
    <div id={id} ref={containerRef} className={className}>
      <MapCtx.Provider value={ctx}>{ctx.map && children}</MapCtx.Provider>
    </div>
  );
}

type Anchor = 'center' | 'top' | 'bottom' | 'left' | 'right';

interface MapMarkerProps {
  position: LngLatLike;
  anchor?: Anchor;
  offset?: [number, number];
  zIndex?: number;
  children: ReactNode;
}

/**
 * 카카오 CustomOverlayMap 대체. 임의의 React 노드를 지도 좌표에 고정한다.
 * children 은 마커 전용 DOM 노드로 portal 되어, 기존 JSX/이벤트/framer-motion 이 그대로 산다.
 */
export function MapMarker({
  position,
  anchor = 'bottom',
  offset,
  zIndex,
  children,
}: MapMarkerProps) {
  const { map, lib } = useMapGL();
  // portal 대상 DOM 은 마커당 한 번만 만든다. 렌더 중 ref 를 쓰면 안 되므로(React 19)
  // useState 초기화 함수로 지연 생성한다 — 초기화 함수는 첫 렌더에 딱 한 번만 실행된다.
  const [el] = useState<HTMLDivElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const d = document.createElement('div');
    d.style.willChange = 'transform'; // 오버레이 DOM 이 지도 상호작용을 방해하지 않도록
    return d;
  });
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!map || !lib || !el) return;
    const marker = new lib.Marker({
      element: el,
      anchor,
      offset: offset ?? [0, 0],
    })
      .setLngLat([position.lng, position.lat])
      .addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, lib, el]);

  // 위치/오프셋 변경은 재생성 없이 반영
  useEffect(() => {
    markerRef.current?.setLngLat([position.lng, position.lat]);
  }, [position.lng, position.lat]);
  useEffect(() => {
    if (markerRef.current && offset) markerRef.current.setOffset(offset);
  }, [offset]);
  useEffect(() => {
    // el 은 우리가 만들어 maplibre 에 넘긴 DOM 노드다. style 을 직접 쓰는 게 목적이므로
    // "state 값을 변경하지 말라" 규칙은 여기선 해당하지 않는다(불변 데이터가 아니라 DOM 핸들).
    // eslint-disable-next-line react-hooks/immutability
    if (el && zIndex != null) el.style.zIndex = String(zIndex);
  }, [el, zIndex]);

  if (!el) return null;
  return createPortal(children, el);
}

interface MapPolylineProps {
  path: LngLatLike[];
  color: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
}

/** 카카오 Polyline 대체. GeoJSON LineString 소스/레이어로 그린다. */
export function MapPolyline({
  path,
  color,
  weight = 4,
  opacity = 0.9,
  dashed = false,
}: MapPolylineProps) {
  const { map } = useMapGL();
  // 레이어 id 는 인스턴스마다 고유해야 한다. Math.random 은 렌더 중 호출이라 불순(재렌더 시 불안정)이므로
  // React 가 보장하는 안정적 고유값을 쓴다. maplibre id 에 안전하도록 영숫자만 남긴다.
  const reactId = useId();
  const layerId = `pl-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const idRef = useRef<string>(layerId);
  // 호출부가 매 렌더 새 배열을 만들어 넘기므로 useMemo 는 절대 적중하지 않는다.
  // 실제 변경 감지는 아래 effect deps 의 이 문자열 값이 하므로, 메모 없이 그대로 계산한다.
  const key = path.map((p) => `${p.lng},${p.lat}`).join(';');

  useEffect(() => {
    if (!map) return;
    const id = idRef.current;
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: path.map((p) => [p.lng, p.lat]) },
    };
    // 소스/레이어를 (없으면) 추가한다. setStyle(테마 전환) 이 레이어를 날려버리므로
    // styledata 이벤트로 재확인해 다시 붙인다. 스타일이 아직 로드 안 됐으면 조용히 패스.
    const ensure = () => {
      if (!map.isStyleLoaded()) return;
      // getSource 는 Source(기반 타입)을 주지만 setData 는 GeoJSONSource 에만 있다.
      // 이 소스는 항상 geojson 으로 add 하므로 GeoJSONSource 로 좁혀 쓴다.
      const src = map.getSource(id) as GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
        return;
      }
      map.addSource(id, { type: 'geojson', data });
      map.addLayer({
        id,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': weight,
          'line-opacity': opacity,
          ...(dashed ? { 'line-dasharray': [2, 2] } : {}),
        },
      });
    };
    ensure();
    map.on('styledata', ensure);
    return () => {
      map.off('styledata', ensure);
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, color, weight, opacity, dashed]);

  return null;
}
