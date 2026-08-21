'use client';

import { MapPin } from 'lucide-react';
import { MapGL, MapMarker } from './MapGL';
import { zoomFromLevel } from './mapStyle';
import { useMapMode } from './useMapMode';
import MapPlaceholder from './MapPlaceholder';
import { hasUsableCoordinates, mapSurface } from '@/lib/mapSurface';
import { useLocale } from '@/lib/i18n';

interface DetailMapProps {
  latitude: number;
  longitude: number;
}

/**
 * 팝업 상세 위치 지도. (기존 카카오 → MapLibre + Protomaps)
 * 좌표 하나를 중심에 두고 라임 핀 하나를 찍는다. 사이트 전역 테마(다크/라이트)를 따른다.
 */
export default function DetailMap({ latitude, longitude }: DetailMapProps) {
  const { locale } = useLocale();
  const labels =
    locale === 'en'
      ? {
          pin: 'Pop-up location',
          empty: 'Location information is unavailable.',
          loading: 'Loading map',
        }
      : locale === 'ja'
        ? {
            pin: 'ポップアップの場所',
            empty: '場所の情報がありません。',
            loading: '地図を読み込み中',
          }
        : { pin: '팝업 위치', empty: '위치 정보가 없습니다.', loading: '지도 불러오는 중' };
  // 사이트 테마 연동 + 테마 확정 전 렌더 보류. InteractiveMap 과 같은 훅을 쓴다. @see useMapMode
  const { mode, ready: mounted } = useMapMode();

  // 갈래는 셋이다 — 지도 · 기다리는 그림 · 없음. 규칙은 lib/mapSurface 참고.
  const surface = mapSurface(mounted, hasUsableCoordinates(latitude, longitude));

  return (
    <div className="w-full h-full min-h-[250px] md:min-h-[350px] bg-cream-300 dark:bg-ink-800 relative rounded-2xl md:rounded-3xl overflow-hidden">
      {surface === 'map' ? (
        <MapGL
          center={{ lat: latitude, lng: longitude }}
          zoom={zoomFromLevel(3)}
          mode={mode}
          className="w-full h-full outline-none"
        >
          <MapMarker position={{ lat: latitude, lng: longitude }} anchor="bottom">
            <div className="relative flex flex-col items-center -mb-1" aria-label={labels.pin}>
              <div className="flex items-center justify-center size-8 rounded-full bg-lime-400 text-ink-900 shadow-lg ring-2 ring-white/70">
                <MapPin size={16} strokeWidth={2.5} />
              </div>
              <div className="w-2 h-2 -mt-1 rotate-45 bg-lime-400 ring-2 ring-white/70" />
            </div>
          </MapMarker>
        </MapGL>
      ) : surface === 'loading' ? (
        /* 좌표는 있고 테마만 아직 모른다. 곧 지도가 뜬다 — 아무 말도 하지 않는다.
           예전엔 이 경우도 아래 "없습니다" 로 흘러가서, 좌표가 멀쩡한 팝업의 서버 HTML 에
           그 문구가 박혀 검색엔진이 그대로 읽어갔다. */
        <MapPlaceholder label={labels.loading} />
      ) : (
        /* 진짜로 좌표가 없는 경우. 이때만 없다고 말한다. */
        <div className="w-full h-full flex items-center justify-center text-subtle-foreground text-xs">
          {labels.empty}
        </div>
      )}
      {/* 지도 위를 덮는 얇은 테두리 (디자인) */}
      <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl md:rounded-3xl" />
    </div>
  );
}
