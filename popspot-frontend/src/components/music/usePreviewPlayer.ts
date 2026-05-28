"use client";

import { useEffect, useRef, useState } from "react";

/**
 * v2.21-S12 — Spotify 30초 Preview 재생 (HTML5 audio).
 *
 * <p>YouTube IFrame 보다 깨끗 (96kbps 원음, 광고 0, 원곡자 100%). Spotify preview_url 직링크를
 * audio 태그로 재생. 30초 끝나면 onEnded → 다음 곡.
 *
 * <p>useYouTubePlayer 와 동일한 인터페이스 (isPlaying / progress / play / pause / toggle /
 * seekPercent) 를 노출해 MusicPlayerProvider 가 엔진을 투명하게 교체할 수 있게 한다.
 *
 * @param previewUrl Spotify preview mp3 직링크 (null 이면 비활성)
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    if (!enabled || !previewUrl || typeof window === "undefined") return;

    const audio = new Audio(previewUrl);
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

    audio.play().catch(() => {
      // 자동재생 차단 (사용자 인터랙션 전) — toggle 로 수동 시작 가능
    });

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
      setIsPlaying(false);
      setProgress(0);
      setCurrentSec(0);
      setDurationSec(0);
    };
  }, [previewUrl, enabled]);

  return {
    isPlaying,
    progress,
    currentSec,
    durationSec,
    play: () => void audioRef.current?.play().catch(() => {}),
    pause: () => audioRef.current?.pause(),
    toggle: () => {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) void a.play().catch(() => {});
      else a.pause();
    },
    seekPercent: (percent: number) => {
      const a = audioRef.current;
      if (!a || !a.duration) return;
      a.currentTime = a.duration * (percent / 100);
    },
  };
}
