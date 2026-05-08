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
 *
 * ⚠️ 핵심 주의:
 *   YouTube API 의 new YT.Player(element, ...) 은 그 element 자체를
 *   <iframe> 으로 교체해버린다. React 가 ref 로 관리하던 노드가 사라지면
 *   reconcile 단계에서 NotFoundError(insertBefore/removeChild) 가 터진다.
 *
 *   해결: React 가 관리하는 wrapper 안에 매번 새 inner div 를 직접 만들어 넣고,
 *   그 inner div 를 YouTube 에 넘긴다. inner 가 iframe 으로 바뀌든 우리가 직접
 *   destroy/remove 하기 때문에 React 트리는 항상 안정적으로 wrapper 만 본다.
 */
export function useYouTubePlayer({ videoId, onEnded }: UsePlayerOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);

  // onEnded 가 매 렌더마다 새 함수가 들어와도 effect 재실행 없이 최신값 참조
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0~100
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  // 1) 플레이어 생성/교체
  useEffect(() => {
    const wrapper = containerRef.current;
    if (!videoId || !wrapper) return;

    let cancelled = false;

    // wrapper 안에 별도 target 노드를 만들어서 YouTube 에 넘긴다.
    // YouTube 가 이 target 을 iframe 으로 교체해도 wrapper 자체는 React 트리에 그대로.
    const target = document.createElement("div");
    wrapper.appendChild(target);

    loadYouTubeApi(() => {
      if (cancelled || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(target, {
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
            if (cancelled) return;
            setIsReady(true);
            setDurationSec(e.target.getDuration?.() ?? 0);
            e.target.playVideo?.();
          },
          onStateChange: (e: any) => {
            if (cancelled) return;
            const state = e.data;
            // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            setIsPlaying(state === 1);
            if (state === 0) onEndedRef.current?.();
          },
        },
      });
    });

    // 클린업: 비디오 변경/언마운트 시 안전하게 정리
    return () => {
      cancelled = true;

      // YouTube Player destroy — iframe 을 자체적으로 제거함
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
      }
      playerRef.current = null;

      // YouTube 가 만든 iframe 이 wrapper 안에 남았다면 직접 제거.
      // 단 wrapper 가 아직 React 트리에 살아있는지 한 번 더 검사 후.
      try {
        if (wrapper && wrapper.isConnected) {
          while (wrapper.firstChild) {
            wrapper.removeChild(wrapper.firstChild);
          }
        }
      } catch {
        // 이미 React 가 wrapper 자체를 unmount 한 경우는 무시
      }

      setIsReady(false);
      setIsPlaying(false);
      setProgress(0);
      setCurrentSec(0);
      setDurationSec(0);
    };
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
