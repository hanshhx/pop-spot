"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, AlertCircle } from "lucide-react";

interface KakaoRoadviewProps {
  lat: number;
  lng: number;
  name: string;
}

export default function KakaoRoadview({ lat, lng, name }: KakaoRoadviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) return;

    const container = containerRef.current;
    if (!container) return;

    window.kakao.maps.load(() => {
      const position = new window.kakao.maps.LatLng(lat, lng);
      const rv = new window.kakao.maps.Roadview(container);
      const rvClient = new window.kakao.maps.RoadviewClient();

      rvClient.getNearestPanoId(position, 50, (panoId: number | null) => {
        if (panoId) {
          rv.setPanoId(panoId, position);

          // ✅ RoadviewCustomOverlay는 존재하지 않는 생성자이므로 CustomOverlay 사용
          const content = `
            <div style="
              padding: 10px 16px;
              background: #ffeb33;
              border-radius: 16px;
              border: 3px solid #000;
              box-shadow: 0 8px 24px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              gap: 8px;
              transform: translateY(-60px);
            ">
              <div style="width: 10px; height: 10px; background: red; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
              <span style="color: #000; font-weight: 900; font-size: 15px; white-space: nowrap;">${name}</span>
            </div>
            <style>
              @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.4); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
              }
            </style>
          `;

          new window.kakao.maps.CustomOverlay({
            position: position,
            content: content,
            map: rv // map 속성에 로드뷰 객체를 전달하여 로드뷰 위에 표시
          });
        } else {
          setIsError(true);
        }
      });
    });
  }, [lat, lng, name]);

  if (isError) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
        <AlertCircle size={48} className="mb-4 text-red-500 opacity-80" />
        <p className="text-lg font-bold">로드뷰를 표시할 수 없는 구역입니다.</p>
        <p className="text-sm opacity-60 mt-1">골목 깊숙한 곳이나 실내 장소일 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-10 bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black shadow-xl flex items-center gap-1">
        <MapPin size={10} /> KAKAO STREET VIEW
      </div>
    </div>
  );
}