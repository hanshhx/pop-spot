'use client';

import { MapPin } from 'lucide-react';
import { MapGL, MapMarker } from './MapGL';
import { zoomFromLevel } from './mapStyle';
import { useMapMode } from './useMapMode';

interface DetailMapProps {
  latitude: number;
  longitude: number;
}

/**
 * 팝업 상세 위치 지도. (기존 카카오 → MapLibre + Protomaps)
 * 좌표 하나를 중심에 두고 라임 핀 하나를 찍는다. 사이트 전역 테마(다크/라이트)를 따른다.
 */
export default function DetailMap({ latitude, longitude }: DetailMapProps) {
  // 사이트 테마 연동 + 테마 확정 전 렌더 보류. InteractiveMap 과 같은 훅을 쓴다. @see useMapMode
  const { mode, ready: mounted } = useMapMode();

  const valid = Number.isFinite(latitude) && Number.isFinite(longitude);

  return (
    <div className="w-full h-full min-h-[250px] md:min-h-[350px] bg-ink-800 relative rounded-2xl md:rounded-3xl overflow-hidden">
      {mounted && valid ? (
        <MapGL
          center={{ lat: latitude, lng: longitude }}
          zoom={zoomFromLevel(3)}
          mode={mode}
          className="w-full h-full outline-none"
        >
          <MapMarker position={{ lat: latitude, lng: longitude }} anchor="bottom">
            <div className="relative flex flex-col items-center -mb-1" aria-label="팝업 위치">
              <div className="flex items-center justify-center size-8 rounded-full bg-lime-400 text-ink-900 shadow-lg ring-2 ring-white/70">
                <MapPin size={16} strokeWidth={2.5} />
              </div>
              <div className="w-2 h-2 -mt-1 rotate-45 bg-lime-400 ring-2 ring-white/70" />
            </div>
          </MapMarker>
        </MapGL>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted text-xs">
          위치 정보가 없습니다.
        </div>
      )}
      {/* 지도 위를 덮는 얇은 테두리 (디자인) */}
      <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl md:rounded-3xl" />
    </div>
  );
}
