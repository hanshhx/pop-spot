"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

/**
 * v2.21-S13 — Spotify Web Playback SDK (Premium 풀트랙 320kbps).
 *
 * <p>흐름:
 *
 * <ol>
 *   <li>sdk.scdn.co/spotify-player.js 동적 로드
 *   <li>new Spotify.Player({ getOAuthToken }) — 토큰은 /api/spotify/token 에서 (자동 refresh)
 *   <li>ready 이벤트 → device_id 확보
 *   <li>트랙 재생: PUT /v1/me/player/play?device_id=X { uris: ["spotify:track:..."] }
 *   <li>player_state_changed → isPlaying / progress 추적
 * </ol>
 *
 * <p>Premium 아니면 SDK 가 initialization_error / account_error → enabled=false 로 두고
 * Provider 가 preview 폴백. 데스크탑 전용 (모바일 브라우저 미지원) — 모바일은 Provider 가
 * 애초에 이 엔진 선택 안 함.
 *
 * <p>useYouTubePlayer / usePreviewPlayer 와 동일 인터페이스.
 */

declare global {
  interface Window {
    Spotify?: {
      Player: new (opts: SpotifyPlayerOptions) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

type SpotifyPlayerOptions = {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
};

type SpotifyPlaybackState = {
  paused: boolean;
  position: number;
  duration: number;
};

type SpotifyPlayerInstance = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload: unknown) => void) => void;
  removeListener: (event: string) => void;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  getCurrentState: () => Promise<SpotifyPlaybackState | null>;
};

let sdkLoading = false;
const sdkReadyCallbacks: Array<() => void> = [];

function loadSpotifySdk(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.Spotify) {
    cb();
    return;
  }
  sdkReadyCallbacks.push(cb);
  if (sdkLoading) return;
  sdkLoading = true;

  window.onSpotifyWebPlaybackSDKReady = () => {
    sdkReadyCallbacks.forEach((c) => c());
    sdkReadyCallbacks.length = 0;
  };

  const tag = document.createElement("script");
  tag.src = "https://sdk.scdn.co/spotify-player.js";
  tag.async = true;
  document.head.appendChild(tag);
}

async function fetchAccessToken(): Promise<string | null> {
  try {
    const res = await apiFetch("/api/spotify/token");
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

/** Spotify Web API 로 특정 device 에서 트랙 재생. */
async function playTrackOnDevice(deviceId: string, spotifyTrackId: string): Promise<boolean> {
  const token = await fetchAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
      },
    );
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export function useSpotifyPlayer({
  spotifyTrackId,
  enabled,
  onEnded,
}: {
  spotifyTrackId: string | null;
  enabled: boolean;
  onEnded?: () => void;
}) {
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const onEndedRef = useRef(onEnded);
  const lastTrackEndedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // 1) SDK 초기화 + device 등록 (enabled 일 때 1회)
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let cancelled = false;

    loadSpotifySdk(() => {
      if (cancelled || !window.Spotify) return;

      const player = new window.Spotify.Player({
        name: "POP-SPOT Player",
        getOAuthToken: (cb) => {
          void fetchAccessToken().then((t) => {
            if (t) cb(t);
          });
        },
        volume: 1.0,
      });
      playerRef.current = player;

      player.addListener("ready", (payload) => {
        if (cancelled) return;
        const { device_id } = payload as { device_id: string };
        deviceIdRef.current = device_id;
        setIsReady(true);
      });

      player.addListener("not_ready", () => {
        if (!cancelled) setIsReady(false);
      });

      player.addListener("player_state_changed", (payload) => {
        if (cancelled || !payload) return;
        const s = payload as {
          paused: boolean;
          position: number;
          duration: number;
          track_window?: { current_track?: { id?: string } };
        };
        setIsPlaying(!s.paused);
        setCurrentSec(s.position / 1000);
        setDurationSec(s.duration / 1000);
        setProgress(s.duration > 0 ? (s.position / s.duration) * 100 : 0);

        // 곡 종료 감지: position 0 + paused + 이전에 재생 중이었음
        if (s.paused && s.position === 0 && !lastTrackEndedRef.current) {
          lastTrackEndedRef.current = true;
          onEndedRef.current?.();
        } else if (s.position > 0) {
          lastTrackEndedRef.current = false;
        }
      });

      void player.connect();
    });

    return () => {
      cancelled = true;
      if (playerRef.current) {
        try {
          playerRef.current.disconnect();
        } catch {
          /* noop */
        }
      }
      playerRef.current = null;
      deviceIdRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setProgress(0);
      setCurrentSec(0);
      setDurationSec(0);
    };
  }, [enabled]);

  // 2) 트랙 변경 시 재생
  useEffect(() => {
    if (!enabled || !spotifyTrackId || !isReady || !deviceIdRef.current) return;
    lastTrackEndedRef.current = false;
    void playTrackOnDevice(deviceIdRef.current, spotifyTrackId);
  }, [enabled, spotifyTrackId, isReady]);

  // 3) v2.21-S17 — 진행률 폴링.
  // Spotify SDK 의 player_state_changed 는 play/pause/seek/track 변경 때만 발화하고
  // 재생 중에는 position 을 자동으로 갱신하지 않는다. 그래서 진행바가 멈춰 보이거나
  // 실제 위치와 어긋난다. 500ms 마다 getCurrentState() 로 position 을 직접 읽어 보정.
  useEffect(() => {
    if (!enabled || !isReady) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentState) return;
      void p.getCurrentState().then((s) => {
        if (!s) return;
        setIsPlaying(!s.paused);
        setCurrentSec(s.position / 1000);
        setDurationSec(s.duration / 1000);
        setProgress(s.duration > 0 ? (s.position / s.duration) * 100 : 0);
      });
    }, 500);
    return () => clearInterval(id);
  }, [enabled, isReady]);

  return {
    isReady,
    isPlaying,
    progress,
    currentSec,
    durationSec,
    play: () => void playerRef.current?.resume(),
    pause: () => void playerRef.current?.pause(),
    toggle: () => void playerRef.current?.togglePlay(),
    seekPercent: (percent: number) => {
      const p = playerRef.current;
      if (!p || durationSec <= 0) return;
      void p.seek(durationSec * 1000 * (percent / 100));
    },
  };
}
