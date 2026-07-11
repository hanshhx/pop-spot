"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, CustomOverlayMap, Polyline } from "react-kakao-maps-sdk";
import { X, MapPin, ArrowRight, Plus, Minus, Compass, List, ShoppingBag, Coffee, Camera, Zap, Sparkles, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { classifyRegion, regionBySlug, regionLabel, type RegionCode } from "@/lib/regions";
import {
  classifyCategory,
  matchesPeriod,
  periodBySlug,
  categoryBySlug,
  type PeriodCode,
  type CategoryCode,
} from "@/lib/popupSlices";

declare global {
  interface Window {
    kakao: any;
  }
}

interface InteractiveMapProps {
  places?: { 
    id: string | number; 
    name: string; 
    lat: number; 
    lng: number; 
    category?: string;
    reason?: string; 
  }[];
  showPath?: boolean;
  center?: { lat: number; lng: number };
  /** 검색 결과 선택 시 그 팝업 마커로 이동+정보창 오픈. nonce 로 같은 팝업 재검색도 매번 반응. */
  focusReq?: { id: string | number; nonce: number } | null;
  mode?: "DEFAULT" | "PLAN";
  routePaths?: { lat: number; lng: number }[][];
  onMarkerClick?: (popupId: number | string) => void; // 👈 이 부분이 추가되었습니다!
}

interface MapMarkerData {
  popupId: number;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  status?: string;
  category?: string;
  // v2.21-S2 — BROWSE 슬라이스 필터링용
  startDate?: string;
  endDate?: string;
}

// DB 의 실제 카테고리 값과 일치 (자동수집 팝업까지 모두 매칭되도록)
const CATEGORIES = ["ALL", "CHARACTER", "FASHION", "BEAUTY", "FOOD", "CULTURE", "ETC"];

/**
 * v2.18.1 — 사용자 표시용 한국어 라벨. 카테고리 값은 영문(DB 매칭) 그대로 두고
 * UI 만 한글로 바꿔 가독성 ↑.
 */
const CATEGORY_LABEL_KO: Record<string, string> = {
  ALL: "전체",
  CHARACTER: "캐릭터",
  FASHION: "패션",
  BEAUTY: "뷰티",
  FOOD: "푸드",
  CULTURE: "문화",
  ETC: "기타",
};

/**
 * 같은 좌표(같은 빌딩 등)에 박힌 마커들을 작은 원형으로 분산시킨다.
 * 자동수집 geocoding 결과 동일 좌표가 자주 발생해서 시각적으로 1개만 보이는 문제를 해결.
 *
 * 분산 반경: 위경도 0.00005 도 ≈ 약 5m (실제 위치 인식 영향 없는 수준)
 */
function spreadOverlappingMarkers(markers: MapMarkerData[]): MapMarkerData[] {
  // ⚠️ 이 파일은 react-kakao-maps-sdk 의 Map 컴포넌트를 import 하므로
  //    JS 내장 Map 자료구조와 이름이 충돌한다. 그래서 객체(Record) 로 그룹핑.
  const groups: Record<string, MapMarkerData[]> = {};
  for (const m of markers) {
    if (!m.latitude || !m.longitude) continue;
    const key = `${m.latitude},${m.longitude}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }

  const result: MapMarkerData[] = [];
  for (const list of Object.values(groups)) {
    if (list.length === 1) {
      result.push(list[0]);
      continue;
    }
    const baseLat = parseFloat(list[0].latitude);
    const baseLng = parseFloat(list[0].longitude);
    const radius = 0.00005;
    list.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / list.length;
      result.push({
        ...m,
        latitude: (baseLat + radius * Math.cos(angle)).toString(),
        longitude: (baseLng + radius * Math.sin(angle)).toString(),
      });
    });
  }
  return result;
}

export default function InteractiveMap({ places, showPath = false, center, focusReq, mode = "DEFAULT", routePaths = [], onMarkerClick }: InteractiveMapProps) {
  const [allMarkers, setAllMarkers] = useState<MapMarkerData[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerData | null>(null);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [map, setMap] = useState<any>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  // 사용자 현재 위치 — 브라우저 메모리에만 보관 (서버 저장 X · PIPA 부담 최소).
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // v2.21-S3.5 — useSearchParams 가 Suspense 없이 호출돼 production 빌드에서 마운트 실패하던
  // 회귀 차단. window.location.search 를 useEffect 안에서 안전하게 읽고 popstate 로 변경 감지.
  // BROWSE 가 모달 흐름으로 바뀌어 라우팅 의존성이 없어졌으므로 이걸로 충분.
  const [filterSlugs, setFilterSlugs] = useState<{
    region: string | null;
    period: string | null;
    category: string | null;
  }>({ region: null, period: null, category: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setFilterSlugs({
        region: params.get("region"),
        period: params.get("period"),
        category: params.get("category"),
      });
    };
    readFromUrl();
    window.addEventListener("popstate", readFromUrl);
    return () => window.removeEventListener("popstate", readFromUrl);
  }, []);

  const activeRegion: RegionCode | null = useMemo(
    () => (filterSlugs.region ? regionBySlug(filterSlugs.region)?.code ?? null : null),
    [filterSlugs.region],
  );
  const activePeriod: PeriodCode | null = useMemo(
    () => (filterSlugs.period ? periodBySlug(filterSlugs.period)?.code ?? null : null),
    [filterSlugs.period],
  );
  const activeBrowseCategory: CategoryCode | null = useMemo(
    () => (filterSlugs.category ? categoryBySlug(filterSlugs.category)?.code ?? null : null),
    [filterSlugs.category],
  );
  const periodSlug = filterSlugs.period;
  const categorySlug = filterSlugs.category;

  // 데이터 fetch — places (코스 모드) 가 있으면 그대로, 아니면 visible markers 전부.
  // v2.21-S2 — 전 (이전 /api/popups?category=…) 클라이언트 사이드 통합 필터로 변경.
  useEffect(() => {
    if (places && places.length > 0) {
      // (A) 코스 모드 / 작전 모드
      const convertedMarkers: MapMarkerData[] = places.map((p) => {
        const safeLat = (p.lat !== undefined && p.lat !== null) ? p.lat : 37.5445;
        const safeLng = (p.lng !== undefined && p.lng !== null) ? p.lng : 127.0560;

        return {
          popupId: Number(p.id),
          name: p.name || "Unknown",
          address: "My Custom Course",
          latitude: safeLat.toString(),
          longitude: safeLng.toString(),
          category: p.category || "COURSE"
        };
      });
      setAllMarkers(convertedMarkers);
      return;
    }

    // (B) 일반 모드 — v2.21-S2 /api/map/markers 로 통일. category/startDate/endDate 포함.
    fetch('/api/map/markers')
      .then((res) => {
        if (!res.ok) throw new Error('네트워크 응답 실패');
        return res.json();
      })
      .then((data: Array<{ id: number; name: string; location: string | null; latitude: string; longitude: string; category: string | null; startDate: string | null; endDate: string | null }>) => {
        const mapped: MapMarkerData[] = (data ?? []).map((m) => ({
          popupId: m.id,
          name: m.name,
          address: m.location ?? "",
          latitude: m.latitude,
          longitude: m.longitude,
          category: m.category ?? undefined,
          startDate: m.startDate ?? undefined,
          endDate: m.endDate ?? undefined,
        }));
        setAllMarkers(mapped);
      })
      .catch((err) => console.error("❌ API 호출 에러:", err));
  }, [places]);

  // v2.21-S2 — 모든 필터를 클라이언트 사이드에서 적용.
  // 우선순위: category (지도 상단 칩) > BROWSE deep link 카테고리 (없을 때 fallback)
  // region / period 는 BROWSE deep link 만 활성.
  const markers = useMemo(() => {
    let filtered = allMarkers;

    // 카테고리 — 지도 상단 칩이 ALL 일 때만 BROWSE 카테고리 반영.
    if (activeCategory !== "ALL") {
      filtered = filtered.filter(
        (m) => (m.category ?? "").toUpperCase() === activeCategory,
      );
    } else if (activeBrowseCategory) {
      filtered = filtered.filter((m) => classifyCategory(m.category) === activeBrowseCategory);
    }

    if (activeRegion) {
      filtered = filtered.filter((m) => classifyRegion(m.address) === activeRegion);
    }
    if (activePeriod) {
      filtered = filtered.filter((m) =>
        matchesPeriod(m.startDate, m.endDate, activePeriod),
      );
    }

    return spreadOverlappingMarkers(filtered);
  }, [allMarkers, activeCategory, activeBrowseCategory, activeRegion, activePeriod]);

  // center prop 변경 시 지도 이동
  useEffect(() => {
    if (map && center && center.lat && center.lng) {
      const moveLatLon = new window.kakao.maps.LatLng(center.lat, center.lng);
      map.panTo(moveLatLon);
    }
  }, [center, map]);

  // 검색 결과 선택 시 그 팝업 마커로 이동 + 정보창 오픈.
  // 지도의 '자기 마커(allMarkers)'에서 직접 찾으므로 allPopups/Algolia 좌표에 의존하지 않는다.
  // 검색 시점에 마커가 아직 안 실렸으면 allMarkers 로드 후 재시도(effect deps). 각 요청(nonce)은 1회만 처리.
  const handledFocusRef = useRef<number>(-1);
  useEffect(() => {
    if (!map || !focusReq) return;
    if (handledFocusRef.current === focusReq.nonce) return;
    const target = allMarkers.find((m) => String(m.popupId) === String(focusReq.id));
    if (!target) return;
    const lat = parseFloat(target.latitude);
    const lng = parseFloat(target.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    handledFocusRef.current = focusReq.nonce;
    map.panTo(new window.kakao.maps.LatLng(lat, lng));
    map.setLevel(4);
    setSelectedMarker(target);
  }, [focusReq, map, allMarkers]);

  /**
   * "내 위치" 버튼 클릭 시 호출.
   *
   * <p>현재 위치 좌표를 상태에 보관해 지도 위에 파란 점 마커로 표시하고, 지도 중심을 그쪽으로 이동.
   * 좌표는 브라우저 메모리에만 살아있고 서버로 전송되지 않는다 (PIPA / 위치정보보호법 부담 최소).
   */
  const handleMyLocation = () => {
    if (!navigator.geolocation || !map) {
      notify("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        const locPosition = new window.kakao.maps.LatLng(lat, lng);
        map.panTo(locPosition);
      },
      () => notify("위치 정보를 가져올 수 없습니다. 브라우저 권한을 확인해주세요."),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 },
    );
  };

  const zoomIn = () => map && map.setLevel(map.getLevel() - 1);
  const zoomOut = () => map && map.setLevel(map.getLevel() + 1);

  const moveToMarker = (marker: MapMarkerData) => {
    if (!map) return;
    const lat = parseFloat(marker.latitude);
    const lng = parseFloat(marker.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
    map.panTo(moveLatLon);
    setSelectedMarker(marker);
  };

  // 카테고리별 스타일 매핑 — DB 실제 카테고리에 맞춤
  const getCategoryStyle = (category?: string) => {
    const cat = category?.toUpperCase() || "ETC";
    switch (cat) {
      case "CHARACTER": return { color: "text-purple-400", border: "border-purple-400", icon: <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3" /> };
      case "FASHION":   return { color: "text-hot-400", border: "border-hot-400", icon: <ShoppingBag className="w-2.5 h-2.5 md:w-3 md:h-3" /> };
      case "BEAUTY":    return { color: "text-pink-400", border: "border-pink-400", icon: <Camera className="w-2.5 h-2.5 md:w-3 md:h-3" /> };
      case "FOOD":      return { color: "text-orange-500", border: "border-orange-500", icon: <Coffee className="w-2.5 h-2.5 md:w-3 md:h-3" /> };
      case "CULTURE":   return { color: "text-cyan-400", border: "border-cyan-400", icon: <Palette className="w-2.5 h-2.5 md:w-3 md:h-3" /> };
      default:          return { color: "text-lime-500", border: "border-lime-300", icon: <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3" /> };
    }
  };

  return (
    <div className="relative w-full h-full group overflow-hidden rounded-[20px] outline-none">
      <style jsx global>{`
        #map > div:first-child > div > div > div > img {
            filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) !important;
        }
        #map { background-color: #1a1a1a !important; }
      `}</style>

      {/* v2.21-S2 — 활성 BROWSE 필터 배지 (좌측 상단). 사용자가 어떤 필터가 적용됐는지 즉시 인지. */}
      {!showPath && mode !== "PLAN" && (activeRegion || activePeriod || activeBrowseCategory) && (
        <div className="absolute top-12 md:top-14 left-3 md:left-4 z-30 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-1.5rem)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 mr-1">
            필터:
          </span>
          {activeRegion && (
            <FilterBadge label={regionLabel(activeRegion)} paramKey="region" />
          )}
          {activePeriod && (
            <FilterBadge
              label={periodBySlug(periodSlug ?? "")?.label ?? activePeriod}
              paramKey="period"
            />
          )}
          {activeBrowseCategory && (
            <FilterBadge
              label={categoryBySlug(categorySlug ?? "")?.label ?? activeBrowseCategory}
              paramKey="category"
            />
          )}
          <span className="text-[10px] font-bold text-lime-300 ml-1">
            {markers.length}건
          </span>
        </div>
      )}

      {/* PLAN 모드가 아니고 showPath도 아닐 때만 카테고리/사이드바 표시 */}
      {!showPath && mode !== "PLAN" && (
        <>
          {/* 상단 카테고리 필터 (반응형 패딩, 폰트 조절) */}
          <div className="absolute top-3 md:top-4 left-3 md:left-4 right-3 md:right-4 z-20 flex gap-1.5 md:gap-2 overflow-x-auto custom-scrollbar pb-1.5 md:pb-2 pl-10 md:pl-0 transition-all">
            {CATEGORIES.map((cat) => (
              <button
                key={`cat-btn-${cat}`} 
                onClick={() => {
                    setActiveCategory(cat);
                    setSelectedMarker(null);
                }}
                className={`px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[9px] md:text-[10px] font-bold backdrop-blur-md border transition-all whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-primary text-black border-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]' 
                    : 'bg-black/40 text-white/70 border-white/10 hover:bg-white/10'
                }`}
              >
                {CATEGORY_LABEL_KO[cat] ?? cat}
              </button>
            ))}
          </div>

          {/* 사이드바 목록 (반응형 너비 조절) */}
          <AnimatePresence>
            {isListOpen && (
              <motion.div
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute top-0 left-0 bottom-0 w-[240px] md:w-[280px] z-30 bg-black/80 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-2xl"
              >
                <div className="p-3 md:p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-white font-bold text-base md:text-lg flex items-center gap-1.5 md:gap-2">
                        <List size={16} className="text-primary md:w-[18px] md:h-[18px]"/> POPUP LIST
                    </h3>
                    <button onClick={() => setIsListOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={16} className="text-muted hover:text-white md:w-[18px] md:h-[18px]"/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-3 space-y-1.5 md:space-y-2">
                    {markers.length > 0 ? (
                        markers.map((marker, index) => (
                            <div 
                                key={`sidebar-item-${marker.popupId || index}`} 
                                onClick={() => moveToMarker(marker)}
                                className={`p-2.5 md:p-3 rounded-xl border cursor-pointer transition-all hover:translate-x-1 ${
                                    selectedMarker?.popupId === marker.popupId 
                                        ? 'bg-white/10 border-primary/50 shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]' 
                                        : 'bg-transparent border-white/5 hover:bg-white/5 hover:border-white/20'
                                }`}
                            >
                                <h4 className={`font-bold text-xs md:text-sm mb-1 ${selectedMarker?.popupId === marker.popupId ? 'text-primary' : 'text-white'}`}>
                                    {marker.name}
                                </h4>
                                <p className="text-[10px] md:text-xs text-muted flex items-center gap-1 truncate">
                                    <MapPin size={10} className="shrink-0"/> {marker.address}
                                </p>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-muted text-[10px] md:text-xs py-8 md:py-10">
                            해당 카테고리의<br/>팝업스토어가 없습니다.
                        </div>
                    )}
                </div>
                
                <div className="p-2.5 md:p-3 border-t border-white/10 text-center">
                    <span className="text-[10px] md:text-xs text-muted">
                        Total <strong className="text-white">{markers.length}</strong> Locations
                    </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 우측 하단 리스트 컨트롤러 (반응형 여백/크기 조절) */}
          <div className="absolute bottom-4 md:bottom-6 right-3 md:right-4 z-20 flex flex-col gap-2">
             <button
               onClick={() => setIsListOpen(!isListOpen)}
               className={`p-2 md:p-2.5 backdrop-blur-md border rounded-lg md:rounded-xl text-white transition-all shadow-lg ${
                   isListOpen
                        ? 'bg-primary text-black border-primary'
                        : 'bg-black/80 border-white/20 hover:text-primary hover:border-primary'
               }`}
             >
                <List size={16} className="md:w-[18px] md:h-[18px]" />
             </button>
          </div>
        </>
      )}

      {/* 공통 컨트롤러 (위치, 줌) - 반응형 여백 조절 */}
      <div className="absolute right-3 md:right-4 z-20 flex flex-col gap-1.5 md:gap-2" style={{ bottom: (showPath || mode === "PLAN") ? '16px' : '64px' }}>
         <button 
           onClick={handleMyLocation}
           className="p-2 md:p-2.5 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg md:rounded-xl text-white hover:text-primary hover:border-primary transition-colors shadow-lg"
         >
            <Compass size={16} className="md:w-[18px] md:h-[18px]" />
         </button>

         <div className="flex flex-col bg-black/80 backdrop-blur-md border border-white/20 rounded-lg md:rounded-xl overflow-hidden shadow-lg">
            <button onClick={zoomIn} aria-label="확대" className="p-2 md:p-2.5 text-white hover:text-primary hover:bg-white/10 transition-colors border-b border-white/10 flex items-center justify-center">
                <Plus size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button onClick={zoomOut} aria-label="축소" className="p-2 md:p-2.5 text-white hover:text-primary hover:bg-white/10 transition-colors flex items-center justify-center">
                <Minus size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
         </div>
      </div>

      <Map
        id="map"
        center={{ lat: 37.5441, lng: 127.0631 }}
        style={{ width: "100%", height: "100%" }}
        level={showPath || mode === "PLAN" ? 4 : 4}
        onClick={() => setSelectedMarker(null)}
        onCreate={setMap}
      >
        
        {(showPath || mode === "PLAN") && routePaths.length > 0 ? (
            // 1. 실제 경로 데이터가 있으면 '실선(Solid)'으로 그립니다 (네비게이션 스타일)
            routePaths.map((path, idx) => (
                <Polyline
                    key={`route-${idx}`}
                    path={path}
                    strokeWeight={5} 
                    strokeColor={"#4f46e5"} 
                    strokeOpacity={0.9} 
                    strokeStyle={"solid"} 
                />
            ))
        ) : (
            // 2. 경로 데이터가 없으면 기존 '점선(Dash)'으로 직선을 그립니다 (Fallback)
            (showPath || mode === "PLAN") && markers.length >= 2 && (
                <Polyline
                    path={markers.map(m => ({ lat: parseFloat(m.latitude), lng: parseFloat(m.longitude) }))}
                    strokeWeight={4}
                    strokeColor={"#666"}
                    strokeOpacity={0.5}
                    strokeStyle={"shortdash"}
                />
            )
        )}

        {/* 사용자 현재 위치 마커 — 파란 점 + pulse ring. 클릭 X (단순 표시용). */}
        {userLocation && (
          <CustomOverlayMap position={userLocation} yAnchor={0.5} xAnchor={0.5}>
            <div className="relative" aria-label="내 위치">
              <span className="absolute inset-0 -m-3 rounded-full bg-blue-400/30 animate-ping" />
              <span className="relative block size-4 rounded-full bg-blue-500 ring-2 ring-white shadow-md" />
            </div>
          </CustomOverlayMap>
        )}

        {markers.map((marker, index) => {
            // PLAN 모드용 스타일 계산
            const style = getCategoryStyle(marker.category);

            return (
              <CustomOverlayMap
                key={`marker-overlay-${marker.popupId || index}`} 
                position={{
                  lat: parseFloat(marker.latitude),
                  lng: parseFloat(marker.longitude),
                }}
                yAnchor={1}
                zIndex={selectedMarker?.popupId === marker.popupId ? 99 : 1}
              >
                <div 
                  className="relative cursor-pointer group/marker"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveToMarker(marker);
                  }}
                >
                  
                  {showPath || mode === "PLAN" ? (
                      <div className="relative flex flex-col items-center hover:z-50">
                          {/* 1. 이름표 (항상 보임) - 모바일 텍스트 및 패딩 조정 */}
                          <div className={`flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl shadow-lg border-2 bg-white ${style.border} mb-1 transform transition-all group-hover/marker:scale-110`}>
                            <span className={`font-black text-[10px] md:text-xs ${style.color}`}>{index + 1}</span>
                            <span className="w-px h-2.5 md:h-3 bg-gray-200"></span>
                            <span className="font-bold text-[10px] md:text-xs text-gray-800 whitespace-nowrap">{marker.name}</span>
                            <span className={`${style.color}`}>{style.icon}</span>
                          </div>

                          {/* 2. 지도 핀 */}
                          <div className="relative">
                             <div className={`w-3 h-3 md:w-4 md:h-4 transform rotate-45 border-r border-b bg-white ${style.border} -mt-2 md:-mt-3`}></div>
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 bg-white rounded-full mt-[-6px] md:mt-[-10px]"></div>
                          </div>
                          
                          {/* 그림자 */}
                          <div className="w-6 h-1.5 md:w-8 md:h-2 bg-black/20 blur-sm rounded-full mt-1"></div>
                      </div>
                  ) : (
                      // 기본 모드 — 카테고리 색상 + 이름이 항상 보이는 작은 카드 핀.
                      <div className="relative flex flex-col items-center hover:z-50">
                          {/* 이름 카드 — 항상 보임. 카테고리 색상으로 강조 */}
                          <div
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg shadow-lg backdrop-blur-md border-2 whitespace-nowrap transform transition-all group-hover/marker:scale-110 ${
                              selectedMarker?.popupId === marker.popupId
                                ? `bg-primary text-black ${style.border}`
                                : `bg-white text-gray-800 dark:bg-black/85 dark:text-white ${style.border}`
                            }`}
                          >
                            <span className={selectedMarker?.popupId === marker.popupId ? 'text-black' : style.color}>
                              {style.icon}
                            </span>
                            <span className="font-bold text-[10px] md:text-xs">
                              {marker.name.length > 10 ? marker.name.slice(0, 10) + '…' : marker.name}
                            </span>
                          </div>

                          {/* 카드 아래 작은 점 (위치 표시) */}
                          <div className={`w-2 h-2 mt-0.5 rounded-full border-2 border-gray-400 dark:border-black ${
                            selectedMarker?.popupId === marker.popupId ? 'bg-primary' : 'bg-white'
                          }`}></div>

                          {/* ping 효과 — 선택된 마커만 */}
                          {selectedMarker?.popupId === marker.popupId && (
                            <div className="absolute bottom-0 w-2 h-2 rounded-full bg-primary opacity-70 animate-ping"></div>
                          )}
                      </div>
                  )}
                </div>
              </CustomOverlayMap>
            );
        })}

        {/* 선택된 마커 오버레이 (상세 정보) - 모바일 패딩 및 사이즈 최적화 */}
        {selectedMarker && (
          <CustomOverlayMap
            key={`selected-popup-overlay-${selectedMarker.popupId}`} 
            position={{
              lat: parseFloat(selectedMarker.latitude),
              lng: parseFloat(selectedMarker.longitude),
            }}
            yAnchor={showPath || mode === "PLAN" ? 1.6 : 1.4}
            zIndex={100}
            clickable={true}
          >
            
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative min-w-[160px] md:min-w-[200px] p-3 md:p-4 bg-black/80 backdrop-blur-md border border-white/20 rounded-xl md:rounded-2xl shadow-2xl text-left cursor-pointer hover:border-primary transition-colors group"
              onClick={() => {
                 if (onMarkerClick && selectedMarker.popupId) {
                     onMarkerClick(selectedMarker.popupId);
                 }
              }}
            >
                <button 
                  onClick={(e) => {
                      e.stopPropagation(); // 클릭 이벤트가 상세페이지 이동으로 번지는 것을 막음
                      setSelectedMarker(null);
                  }}
                  className="absolute top-1.5 right-1.5 md:top-2 md:right-2 text-white/50 hover:text-white transition-colors z-10"
                >
                  <X size={12} className="md:w-3.5 md:h-3.5" />
                </button>

                <div className="flex items-center gap-1.5 md:gap-2 mb-1">
                    <span className="text-[8px] md:text-[9px] px-1 md:px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                        {selectedMarker.category || 'POPUP'}
                    </span>
                    <h3 className="text-white font-bold text-xs md:text-base truncate pr-4 group-hover:text-primary transition-colors">{selectedMarker.name}</h3>
                </div>

                <p className="text-muted text-[9px] md:text-xs flex items-center gap-1 mb-2 md:mb-3">
                  <MapPin size={8} className="md:w-2.5 md:h-2.5 shrink-0" /> <span className="truncate">{selectedMarker.address}</span>
                </p>

                {/* 상세 보기 — 명시적 버튼으로 이동(클릭이 아래 마커/지도로 흘러 재선택만 되던 버그 수정). */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onMarkerClick && selectedMarker.popupId) onMarkerClick(selectedMarker.popupId);
                  }}
                  className="w-full py-1.5 md:py-2 bg-white/10 group-hover:bg-primary group-hover:text-black rounded-md md:rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 text-white cursor-pointer"
                >
                  상세 보기 <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform md:w-2.5 md:h-2.5"/>
                </button>

                <div className="absolute bottom-[-5px] md:bottom-[-6px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 md:w-3 md:h-3 bg-black/80 border-r border-b border-white/20 rotate-45 transform"></div>
            </motion.div>
          </CustomOverlayMap>
        )}
      </Map>
    </div>
  );
}

/**
 * v2.21-S2 — 활성 BROWSE 필터 배지. X 버튼 클릭 시 해당 쿼리만 URL 에서 제거.
 * router.replace 로 history 더럽히지 않게 처리.
 */
function FilterBadge({ label, paramKey }: { label: string; paramKey: string }) {
  function handleRemove() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete(paramKey);
    window.history.replaceState({}, "", url.toString());
    // searchParams 변경을 React 가 감지하도록 강제 navigation
    window.location.replace(url.toString());
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-lime-300 text-ink-900 shadow-md">
      {label}
      <button
        type="button"
        onClick={handleRemove}
        aria-label={`${label} 필터 해제`}
        className="opacity-70 hover:opacity-100 transition-opacity"
      >
        <X size={10} strokeWidth={3} />
      </button>
    </span>
  );
}
