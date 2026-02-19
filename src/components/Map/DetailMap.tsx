"use client";

import { useEffect, useRef } from "react";

interface DetailMapProps {
  latitude: number;
  longitude: number;
}

declare global {
  interface Window {
    kakao: any;
  }
}

export default function DetailMap({ latitude, longitude }: DetailMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. 카카오 스크립트 로드 확인
    if (!window.kakao || !window.kakao.maps) {
      return;
    }

    // 2. 좌표가 없으면 중단
    if (!latitude || !longitude) return;

    window.kakao.maps.load(() => {
      const container = mapRef.current;
      const options = {
        center: new window.kakao.maps.LatLng(latitude, longitude),
        level: 3,
      };

      const map = new window.kakao.maps.Map(container, options);

      // 마커 표시
      const markerPosition = new window.kakao.maps.LatLng(latitude, longitude);
      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
      });
      marker.setMap(map);
    });
  }, [latitude, longitude]);

  return (
    <div className="w-full h-full bg-gray-800 relative">
      <div ref={mapRef} className="w-full h-full" />
      {/* 지도 위를 덮는 얇은 테두리 (디자인) */}
      <div className="absolute inset-0 pointer-events-none border border-white/10"></div>
    </div>
  );
}