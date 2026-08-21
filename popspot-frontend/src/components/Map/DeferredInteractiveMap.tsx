'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import type { InteractiveMapProps } from './InteractiveMap';
import MapPlaceholder from './MapPlaceholder';

const InteractiveMap = dynamic(() => import('./InteractiveMap'), {
  ssr: false,
  loading: () => <MapLoadingSurface />,
});

/**
 * 지도가 오기 전 자리.
 *
 * <p>예전에는 <code>bg-ink-900</code> 한 겹이라, 라이트 화면에서 흰 카드 안에 <b>검은 사각형</b>이
 * 잠깐 떴다가 밝은 지도로 바뀌었다. 두 번 튀는 셈이다. 격자는 테마를 따라간다.
 */
function MapLoadingSurface() {
  return (
    <MapPlaceholder label="Loading map" className="min-h-[280px] rounded-[20px]" />
  );
}

/** Loads the map bundle only when its surface is close to the viewport. */
export default function DeferredInteractiveMap(props: InteractiveMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || ready) return;
    if (!('IntersectionObserver' in window)) {
      const timer = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div ref={hostRef} className="h-full w-full">
      {ready ? <InteractiveMap {...props} /> : <MapLoadingSurface />}
    </div>
  );
}
