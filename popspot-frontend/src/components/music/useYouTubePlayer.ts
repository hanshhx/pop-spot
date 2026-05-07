"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoaded = false;
const apiCallbacks: Array<() => void> = [];

function loadYouTubeApi(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.YT && window.YT.Player) {
    cb();
    return;
  }
  apiCallbacks.push(cb);
  if (apiLoaded) return;
  apiLoaded = true;

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    apiCallbacks.forEach((c) => c());
    apiCallbacks.length = 0;
  };
}

interface UsePlayerOptions {
  videoId: string | null;
  onEnded?: () => void;
}

/**
 * YouTube IFrame Player 자체 컨트롤 훅.
 * 컨트롤바/시간/추천영상 모두 숨김.
 * 자체 진행률 / 재생/일시정지 / 다음곡 가능.
 */
export function useYouTubePlayer({ videoId, onEnded }: UsePlayerOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0~100
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  // 1) 플레이어 생성
  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    let cancelled = false;
    loadYouTubeApi(() => {
      if (cancelled) return;
      // 기존 플레이어 정리
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        height: "0",
        width: "0",
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            setIsReady(true);
            setDurationSec(e.target.getDuration?.() ?? 0);
            e.target.playVideo?.();
          },
          onStateChange: (e: any) => {
            const state = e.data;
            // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 video cued
            setIsPlaying(state === 1);
            if (state === 0 && onEnded) onEnded();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      setIsReady(false);
      setIsPlaying(false);
      setProgress(0);
      setCurrentSec(0);
      setDurationSec(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // 2) 진행률 폴링
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const cur = p.getCurrentTime() ?? 0;
      const dur = p.getDuration() ?? 0;
      setCurrentSec(cur);
      setDurationSec(dur);
      setProgress(dur > 0 ? (cur / dur) * 100 : 0);
    }, 500);
    return () => clearInterval(id);
  }, []);

  return {
    containerRef,
    isReady,
    isPlaying,
    progress,
    currentSec,
    durationSec,
    play: () => playerRef.current?.playVideo?.(),
    pause: () => playerRef.current?.pauseVideo?.(),
    toggle: () => {
      if (!playerRef.current) return;
      if (isPlaying) playerRef.current.pauseVideo?.();
      else playerRef.current.playVideo?.();
    },
    seekPercent: (percent: number) => {
      const p = playerRef.current;
      if (!p?.getDuration) return;
      const dur = p.getDuration();
      p.seekTo?.(dur * (percent / 100), true);
    },
  };
}
