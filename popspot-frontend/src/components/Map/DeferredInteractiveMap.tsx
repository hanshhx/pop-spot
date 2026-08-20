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
      className="relative h-full min-h-[280px] w-full overflow-hidden rounded-[20px] bg-[#f5f4ec] dark:bg-ink-900"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(79,122,16,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(79,122,16,0.055)_1px,transparent_1px)] bg-[size:38px_38px] dark:bg-[linear-gradient(rgba(194,249,112,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(194,249,112,0.04)_1px,transparent_1px)]" />
      <div className="absolute -left-20 top-[64%] h-24 w-[145%] -rotate-6 border-t border-lime-700/10 dark:border-lime-200/10" />
      <div className="absolute -bottom-12 -left-12 h-56 w-[130%] rotate-6 rounded-[50%] border-[24px] border-lime-400/10 dark:border-lime-400/[0.07]" />
      <div className="absolute left-[24%] top-[42%] size-3 animate-pulse rounded-full bg-lime-400/60 shadow-[0_0_20px_rgba(168,230,69,0.45)] motion-reduce:animate-none" />
      <div className="absolute right-[21%] top-[55%] size-2.5 animate-pulse rounded-full bg-lime-400/45 shadow-[0_0_16px_rgba(168,230,69,0.35)] [animation-delay:700ms] motion-reduce:animate-none" />
      <div className="absolute inset-x-5 top-5 h-10 animate-pulse rounded-full border border-black/5 bg-white/55 motion-reduce:animate-none dark:border-white/10 dark:bg-white/10" />
      <span className="sr-only">Loading map</span>
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
