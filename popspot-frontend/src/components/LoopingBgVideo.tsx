'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';

const CROSSFADE_MS = 1200;

/**
 * 끊김 없는 배경 영상 루프.
 *
 * <p>네이티브 {@code loop} 는 끝 프레임 → 시작 프레임이 튀어 "뚝" 끊겨 보인다(영상이 seamless 하지 않을 때).
 * 두 개의 {@code <video>} 를 핑퐁 크로스페이드해 영상 내용과 무관하게 매끄럽게 잇는다: 활성 영상이 끝나기
 * 약 {@code CROSSFADE_MS} 전, 반대편을 0 초부터 재생하며 opacity 를 교차한다.
 *
 * <p>opacity 는 CSS transition 이 아니라 requestAnimationFrame 으로 매 프레임 직접 쓴다. (GPU 레이어 +
 * opacity transition 조합이 일부 환경에서 진행되지 않는 문제가 있어, rAF 로 결정적으로 애니메이션한다.)
 */
export default function LoopingBgVideo({
  src,
  rate = 1,
  className = '',
}: {
  src: string;
  rate?: number;
  className?: string;
}) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const activeIsA = useRef(true);
  const swapping = useRef(false);
  const rafRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const applyRate = useCallback(
    (v: HTMLVideoElement | null) => {
      if (v) {
        try {
          v.playbackRate = rate;
        } catch {
          /* metadata 전 설정 예외 무시 */
        }
      }
    },
    [rate],
  );

  // rAF 크로스페이드: incoming 0→1, outgoing 1→0 을 CROSSFADE_MS 동안.
  const crossfade = useCallback(
    (incoming: HTMLVideoElement | null, outgoing: HTMLVideoElement | null) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      let startTs = 0;
      const step = (ts: number) => {
        if (!startTs) startTs = ts;
        const p = Math.min(1, (ts - startTs) / CROSSFADE_MS);
        if (incoming) incoming.style.opacity = String(p);
        if (outgoing) outgoing.style.opacity = String(1 - p);
        rafRef.current = p < 1 ? requestAnimationFrame(step) : 0;
      };
      rafRef.current = requestAnimationFrame(step);
      // 폴백: 백그라운드 탭 등 rAF 가 멈춘 경우에도 최종 상태를 보장(setTimeout 은 백그라운드에서도 발화).
      window.setTimeout(() => {
        if (incoming) incoming.style.opacity = '1';
        if (outgoing) outgoing.style.opacity = '0';
      }, CROSSFADE_MS + 80);
    },
    [],
  );

  // 마운트 / 테마(src) 변경 시: A 를 처음부터 보이게, B 는 숨겨 대기.
  useEffect(() => {
    activeIsA.current = true;
    swapping.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const a = aRef.current;
    const b = bRef.current;
    if (a) {
      a.style.opacity = '1';
      try {
        a.currentTime = 0;
      } catch {
        /* noop */
      }
      applyRate(a);
      void a.play().catch(() => undefined);
    }
    if (b) {
      b.style.opacity = '0';
      b.pause();
      try {
        b.currentTime = 0;
      } catch {
        /* noop */
      }
      applyRate(b);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src, applyRate]);

  const handleTimeUpdate = useCallback(
    (isA: boolean) => (e: SyntheticEvent<HTMLVideoElement>) => {
      if (swapping.current || isA !== activeIsA.current) return;
      const cur = e.currentTarget;
      const dur = cur.duration;
      if (!dur || !Number.isFinite(dur)) return;
      if ((dur - cur.currentTime) / (rate || 1) > CROSSFADE_MS / 1000 + 0.25) return;

      swapping.current = true;
      const incoming = (isA ? bRef : aRef).current;
      const outgoing = (isA ? aRef : bRef).current;
      if (incoming) {
        try {
          incoming.currentTime = 0;
        } catch {
          /* noop */
        }
        applyRate(incoming);
        void incoming.play().catch(() => undefined);
      }
      crossfade(incoming, outgoing);
      activeIsA.current = !isA;
      window.setTimeout(() => {
        swapping.current = false;
      }, CROSSFADE_MS + 300);
    },
    [rate, applyRate, crossfade],
  );

  const base = 'absolute inset-0 h-full w-full object-cover';

  if (reduceMotion) return null;

  return (
    <>
      <video
        ref={aRef}
        autoPlay
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => applyRate(e.currentTarget)}
        onTimeUpdate={handleTimeUpdate(true)}
        className={`${base} ${className}`}
      >
        <source
          src={src}
          type="video/mp4"
          media="(min-width: 768px) and (prefers-reduced-motion: no-preference)"
        />
      </video>
      <video
        ref={bRef}
        muted
        playsInline
        preload="none"
        onLoadedMetadata={(e) => applyRate(e.currentTarget)}
        onTimeUpdate={handleTimeUpdate(false)}
        className={`${base} ${className}`}
      >
        <source
          src={src}
          type="video/mp4"
          media="(min-width: 768px) and (prefers-reduced-motion: no-preference)"
        />
      </video>
    </>
  );
}
