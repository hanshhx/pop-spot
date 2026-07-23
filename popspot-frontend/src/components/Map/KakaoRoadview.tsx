'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';

import { escapeHtml } from '@/lib/escapeHtml';

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
            <div class="roadview-overlay">
              <div class="pulse-dot"></div>
              <span class="overlay-text">${escapeHtml(name)}</span>
            </div>
            <style>
              .roadview-overlay {
                background: #ffeb33;
                border-radius: 12px;
                border: 2px solid #000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                gap: 6px;
                transform: translateY(-40px);
                padding: 6px 10px;
              }
              .pulse-dot {
                width: 8px; 
                height: 8px; 
                background: red; 
                border-radius: 50%; 
                animation: pulse 1.5s infinite;
              }
              .overlay-text {
                color: #000; 
                font-weight: 900; 
                font-size: 12px; 
                white-space: nowrap;
              }
              
              /* MD(태블릿/PC) 사이즈 이상일 때 커지는 반응형 로직 */
              @media (min-width: 768px) {
                .roadview-overlay {
                  padding: 10px 16px;
                  border-radius: 16px;
                  border-width: 3px;
                  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                  gap: 8px;
                  transform: translateY(-60px);
                }
                .pulse-dot { 
                  width: 10px; 
                  height: 10px; 
                }
                .overlay-text { 
                  font-size: 15px; 
                }
              }

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
            map: rv, // map 속성에 로드뷰 객체를 전달하여 로드뷰 위에 표시
          });
        } else {
          setIsError(true);
        }
      });
    });
  }, [lat, lng, name]);

  if (isError) {
    return (
      <div className="w-full h-full min-h-[200px] md:min-h-[300px] bg-gray-900 flex flex-col items-center justify-center text-gray-400 p-4 md:p-6 text-center rounded-2xl md:rounded-3xl overflow-hidden">
        <AlertCircle className="w-8 h-8 md:w-12 md:h-12 mb-2 md:mb-4 text-red-500 opacity-80" />
        <p className="text-sm md:text-lg font-bold">로드뷰를 표시할 수 없는 구역입니다.</p>
        <p className="text-[10px] md:text-sm opacity-60 mt-0.5 md:mt-1">
          골목 깊숙한 곳이나 실내 장소일 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[250px] md:min-h-[350px] relative rounded-2xl md:rounded-3xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full outline-none" />
      <div className="absolute top-3 md:top-4 left-3 md:left-4 z-10 bg-yellow-400 text-black px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black shadow-xl flex items-center gap-1">
        <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3" /> KAKAO STREET VIEW
      </div>
      {/* 지도 위를 덮는 얇은 테두리 (디자인 일체감) */}
      <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl md:rounded-3xl"></div>
    </div>
  );
}
