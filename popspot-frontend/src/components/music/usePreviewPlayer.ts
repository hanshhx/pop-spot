"use client";

import { useEffect, useRef, useState } from "react";

/**
 * v2.21-S12 — Spotify / Apple 30초 Preview 재생 (HTML5 audio).
 *
 * <p>YouTube IFrame 보다 깨끗 (원음, 광고 0, 원곡자 100%). preview_url 직링크를 audio 태그로
 * 재생. 30초 끝나면 onEnded → 다음 곡.
 *
 * <p>useYouTubePlayer 와 동일한 인터페이스 (isPlaying / progress / play / pause / toggle /
 * seekPercent) 를 노출해 MusicPlayerProvider 가 엔진을 투명하게 교체할 수 있게 한다.
 *
 * <p>v2.21-S18 — 자동재생 차단 대응. 트랙 클릭 → 백엔드 매칭(비동기) → setCurrent → 이 훅이
 * audio.play() 호출까지가 네트워크 콜백 안이라 "사용자 제스처 창" 을 벗어난다. 브라우저는 이때
 * 소리 있는 audio 자동재생을 막아 아무것도 안 들린다. 두 가지로 해결:
 *
 * <ul>
 *   <li>audio 엘리먼트를 트랙마다 새로 만들지 않고 1개를 재사용 — 한 번 재생되면 그 엘리먼트는
 *       세션 내내 unlock 상태라 이후 트랙은 자동재생된다.
 *   <li>play() 가 거부되면 다음 사용자 클릭(아무 곳이나)에 1회 재시도 — 첫 곡도 한 번의 추가
 *       클릭으로 살아난다.
 * </ul>
 *
 * @param previewUrl preview mp3/m4a 직링크 (null 이면 비활성)
 * @param enabled 이 엔진이 활성 모드일 때만 true (3-tier 중 preview 선택 시)
 */
export function usePreviewPlayer({
  previewUrl,
  enabled,
  onEnded,
}: {
  previewUrl: string | null;
  enabled: boolean;
  onEnded?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);
  const lastUrlRef = useRef<string | null>(null);
  // 재생 의도. 자동재생이 막혔을 때 다음 제스처에 재시도할지 판단.
  const wantPlayRef = useRef(false);
  // 재시도 리스너 중복 등록 방지.
  const retryPendingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // 1) audio 엘리먼트 1회 생성 + 이벤트 바인딩. (트랙마다 새로 만들면 unlock 이 유지 안 됨)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 1.0;
    audioRef.current = audio;

    const onTime = () => {
      const dur = audio.duration || 30;
      setCurrentSec(audio.currentTime);
      setDurationSec(dur);
      setProgress(dur > 0 ? (audio.currentTime / dur) * 100 : 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnd = () => {
      setIsPlaying(false);
      onEndedRef.current?.();
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      audio.src = "";
      audioRef.current = null;
      lastUrlRef.current = null;
    };
  }, []);

  // 2) previewUrl / enabled 변경 → src 교체 + 자동재생 시도
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!enabled || !previewUrl) {
      audio.pause();
      wantPlayRef.current = false;
      return;
    }

    wantPlayRef.current = true;
    if (lastUrlRef.current !== previewUrl) {
      audio.src = previewUrl;
      lastUrlRef.current = previewUrl;
      audio.currentTime = 0;
      setProgress(0);
      setCurrentSec(0);
    }

    const attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        // 자동재생 차단 — 다음 사용자 제스처(클릭/터치)에 1회 재시도.
        setIsPlaying(false);
        if (retryPendingRef.current) return;
        retryPendingRef.current = true;
        const retry = () => {
          retryPendingRef.current = false;
          if (!wantPlayRef.current) return;
          audioRef.current?.play().catch(() => {});
        };
        document.addEventListener("pointerdown", retry, { once: true });
      });
    }

    return () => {
      audio.pause();
    };
  }, [previewUrl, enabled]);

  return {
    isPlaying,
    progress,
    currentSec,
    durationSec,
    play: () => {
      wantPlayRef.current = true;
      void audioRef.current?.play().catch(() => {});
    },
    pause: () => {
      wantPlayRef.current = false;
      audioRef.current?.pause();
    },
    toggle: () => {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) {
        wantPlayRef.current = true;
        void a.play().catch(() => {});
      } else {
        wantPlayRef.current = false;
        a.pause();
      }
    },
    seekPercent: (percent: number) => {
      const a = audioRef.current;
      if (!a || !a.duration) return;
      a.currentTime = a.duration * (percent / 100);
    },
  };
}
