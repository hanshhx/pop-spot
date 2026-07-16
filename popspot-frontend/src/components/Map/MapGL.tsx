"use client";

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
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { buildBaseStyle, basemapTileUrl, type MapMode } from "./mapStyle";

type MapInstance = any; // maplibregl.Map
type MapLib = any; // typeof maplibregl

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

export function MapGL({ center, zoom, mode = "dark", onCreate, onClick, className, id, children }: MapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<Ctx>({ map: null, lib: null });
  // 현재 스타일에 실제로 적용된 mode. 불필요한 setStyle(깜빡임) 방지용.
  const appliedModeRef = useRef<MapMode | null>(null);
  // 현재 지도에 적용된 center 좌표(값 기준 비교로 불필요한 이동 방지).
  const centerRef = useRef({ lat: center.lat, lng: center.lng });
  // 최신 콜백을 effect 재실행 없이 참조
  const onCreateRef = useRef(onCreate);
  const onClickRef = useRef(onClick);
  onCreateRef.current = onCreate;
  onClickRef.current = onClick;

  useEffect(() => {
    let map: MapInstance | null = null;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      const { Protocol } = await import("pmtiles");
      if (cancelled || !containerRef.current) return;

      if (!protocolRegistered) {
        maplibregl.addProtocol("pmtiles", new Protocol().tile);
        protocolRegistered = true;
      }

      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildBaseStyle(mode, basemapTileUrl()),
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
        // 한글 라벨을 로컬(브랜드) 폰트로 직접 렌더 — Protomaps 기본폰트엔 한글 글리프가 없음
        localIdeographFontFamily: "'Wanted Sans Variable','Pretendard',sans-serif",
        dragRotate: false,
        pitchWithRotate: false,
      });
      appliedModeRef.current = mode; // 초기 스타일은 마운트 시점 mode 로 지음
      map.touchZoomRotate?.disableRotation?.();

      if (onClickRef.current) map.on("click", () => onClickRef.current?.());

      map.on("load", () => {
        if (cancelled) return;
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
    m.setStyle(buildBaseStyle(mode, basemapTileUrl()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ctx.map]);

  // center prop 이 실제로 바뀌면 지도를 그쪽으로 이동한다. 좌표가 갱신되는 소비자(예: DetailMap
  // 에서 팝업 A→B 이동)를 위해 필요. 값(위경도) 기준 비교라, 부모가 매 렌더 새 객체를 줘도
  // 같은 좌표면 무시한다. 고정 center 를 주고 이동을 자체 처리하는 InteractiveMap 에선 no-op.
  useEffect(() => {
    const m = ctx.map;
    if (!m) return;
    if (centerRef.current.lat === center.lat && centerRef.current.lng === center.lng) return;
    centerRef.current = { lat: center.lat, lng: center.lng };
    m.easeTo({ center: [center.lng, center.lat], duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, ctx.map]);

  return (
    <div id={id} ref={containerRef} className={className}>
      <MapCtx.Provider value={ctx}>{ctx.map && children}</MapCtx.Provider>
    </div>
  );
}

type Anchor = "center" | "top" | "bottom" | "left" | "right";

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
export function MapMarker({ position, anchor = "bottom", offset, zIndex, children }: MapMarkerProps) {
  const { map, lib } = useMapGL();
  const elRef = useRef<HTMLDivElement | null>(null);
  if (elRef.current === null && typeof document !== "undefined") {
    elRef.current = document.createElement("div");
    // 오버레이 DOM 이 지도 상호작용을 방해하지 않도록
    elRef.current.style.willChange = "transform";
  }
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !lib || !elRef.current) return;
    const marker = new lib.Marker({
      element: elRef.current,
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
  }, [map, lib]);

  // 위치/오프셋 변경은 재생성 없이 반영
  useEffect(() => {
    markerRef.current?.setLngLat([position.lng, position.lat]);
  }, [position.lng, position.lat]);
  useEffect(() => {
    if (markerRef.current && offset) markerRef.current.setOffset(offset);
  }, [offset]);
  useEffect(() => {
    if (elRef.current && zIndex != null) elRef.current.style.zIndex = String(zIndex);
  }, [zIndex]);

  if (!elRef.current) return null;
  return createPortal(children, elRef.current);
}

interface MapPolylineProps {
  path: LngLatLike[];
  color: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
}

/** 카카오 Polyline 대체. GeoJSON LineString 소스/레이어로 그린다. */
export function MapPolyline({ path, color, weight = 4, opacity = 0.9, dashed = false }: MapPolylineProps) {
  const { map } = useMapGL();
  const idRef = useRef<string>(`pl-${Math.random().toString(36).slice(2)}`);
  const key = useMemo(() => path.map((p) => `${p.lng},${p.lat}`).join(";"), [path]);

  useEffect(() => {
    if (!map) return;
    const id = idRef.current;
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: path.map((p) => [p.lng, p.lat]) },
    };
    // 소스/레이어를 (없으면) 추가한다. setStyle(테마 전환) 이 레이어를 날려버리므로
    // styledata 이벤트로 재확인해 다시 붙인다. 스타일이 아직 로드 안 됐으면 조용히 패스.
    const ensure = () => {
      if (!map.isStyleLoaded()) return;
      const src = map.getSource(id);
      if (src) {
        src.setData(data);
        return;
      }
      map.addSource(id, { type: "geojson", data });
      map.addLayer({
        id,
        type: "line",
        source: id,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": color,
          "line-width": weight,
          "line-opacity": opacity,
          ...(dashed ? { "line-dasharray": [2, 2] } : {}),
        },
      });
    };
    ensure();
    map.on("styledata", ensure);
    return () => {
      map.off("styledata", ensure);
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, color, weight, opacity, dashed]);

  return null;
}
