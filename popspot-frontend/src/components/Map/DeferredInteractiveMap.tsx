'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import type { InteractiveMapProps } from './InteractiveMap';

const InteractiveMap = dynamic(() => import('./InteractiveMap'), {
  ssr: false,
  loading: () => <MapLoadingSurface />,
});

function MapLoadingSurface() {
  return (
    <div
      role="status"
      aria-label="Loading map"
      className="relative h-full min-h-[280px] w-full overflow-hidden rounded-[20px] bg-ink-900"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(190,242,100,0.15),transparent_35%)]" />
      <div className="absolute inset-x-5 top-5 h-10 animate-pulse rounded-full bg-white/10" />
      <div className="absolute inset-x-4 bottom-4 h-[38%] animate-pulse rounded-3xl border border-white/10 bg-white/10" />
    </div>
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
