"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";
import { MatchResult, MusicTrack } from "@/types/music";
import { useYouTubePlayer } from "./useYouTubePlayer";

/**
 * 글로벌 음악 플레이어 상태.
 *
 * 라우트 이동에 영향받지 않게 layout 최상단에 Provider 를 두고,
 * 어떤 페이지에서든 useMusicPlayer() 로 동일한 인스턴스를 사용한다.
 *
 * 큐 관리:
 *   - playlist : 사용자가 보고 있는 그리드(검색/카테고리/인기)
 *   - autoQueue : 곡 종료 시 자동으로 이어 재생할 추천 큐
 */
type Mode = "hidden" | "mini" | "full";

interface MusicPlayerState {
  current: MusicTrack | null;
  playlist: MusicTrack[];
  match: MatchResult | null;
  matchLoading: boolean;
  mode: Mode;
}

interface MusicPlayerActions {
  play: (track: MusicTrack, playlist?: MusicTrack[]) => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  expand: () => void;
  collapse: () => void;
  seekPercent: (percent: number) => void;
}

interface PlayerSignals {
  isReady: boolean;
  isPlaying: boolean;
  progress: number;
  currentSec: number;
  durationSec: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

type ContextValue = MusicPlayerState & MusicPlayerActions & PlayerSignals;

const MusicPlayerContext = createContext<ContextValue | null>(null);

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<MusicTrack | null>(null);
  const [playlist, setPlaylist] = useState<MusicTrack[]>([]);
  const [autoQueue, setAutoQueue] = useState<MusicTrack[]>([]);
  const [mode, setMode] = useState<Mode>("hidden");

  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  // 추천 큐가 비어가면 미리 다음 곡들을 보충해서 끊김 없이 이어지게 한다
  const refillingRef = useRef(false);

  const player = useYouTubePlayer({
    videoId: current?.youtubeVideoId ?? null,
    onEnded: () => playNextFromQueue(),
  });

  /**
   * 곡 클릭 시 호출.
   * - 현재 재생곡 즉시 갱신 (앨범아트/곡명 바로 보이게)
   * - /play 응답이 오면 youtubeVideoId 가 채워진 track 으로 다시 갱신
   *   → IFrame Player 가 그 시점에 영상 ID 받고 재생 시작
   * - 무드 분석 + 팝업 매칭 결과도 같이 반영
   * - 다음 곡 추천 큐 보충
   */
  const play = useCallback(
    (track: MusicTrack, list?: MusicTrack[]) => {
      setCurrent(track);
      if (list && list.length > 0) setPlaylist(list);
      setMode((prev) => (prev === "hidden" ? "full" : prev));

      setMatch(null);
      setMatchLoading(true);
      apiFetch(`/api/music/${track.id}/play`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: MatchResult | null) => {
          if (!data) return;
          setMatch(data);
          // 백엔드가 lazy fetch 로 youtube_video_id 를 채워서 보내준다.
          // 그 갱신된 track 으로 current 를 덮어써야 IFrame 이 영상을 로드한다.
          if (data.track) setCurrent(data.track);
        })
        .catch(() => null)
        .finally(() => setMatchLoading(false));

      refillAutoQueue(track.id);
    },
    [],
  );

  const refillAutoQueue = useCallback(async (seedId: number) => {
    if (refillingRef.current) return;
    refillingRef.current = true;
    try {
      const res = await apiFetch(`/api/music/${seedId}/next?limit=8`);
      if (!res.ok) return;
      const list: MusicTrack[] = await res.json();
      setAutoQueue(list || []);
    } catch {
      /* 무시 — 큐가 비어도 끝나는 거지 에러는 아님 */
    } finally {
      refillingRef.current = false;
    }
  }, []);

  const playNextFromQueue = useCallback(() => {
    if (!current) return;

    // 사용자 그리드 안에서 다음 곡이 있으면 우선
    const idx = playlist.findIndex((t) => t.id === current.id);
    const next = playlist[idx + 1];
    if (next) {
      play(next, playlist);
      return;
    }

    // 아니면 추천 큐로 이어 재생
    if (autoQueue.length > 0) {
      const [head, ...rest] = autoQueue;
      setAutoQueue(rest);
      play(head);
    }
  }, [current, playlist, autoQueue, play]);

  const next = playNextFromQueue;

  const prev = useCallback(() => {
    if (!current || playlist.length === 0) return;
    const idx = playlist.findIndex((t) => t.id === current.id);
    const before = playlist[idx - 1];
    if (before) play(before, playlist);
  }, [current, playlist, play]);

  const close = useCallback(() => {
    setMode("hidden");
    setCurrent(null);
    setMatch(null);
    setAutoQueue([]);
    player.pause();
  }, [player]);

  const expand = useCallback(() => setMode("full"), []);
  const collapse = useCallback(() => setMode("mini"), []);

  // 곡이 처음 들어왔는데 mode 가 hidden 이면 곧바로 풀 화면으로 띄운다.
  useEffect(() => {
    if (current && mode === "hidden") setMode("full");
  }, [current, mode]);

  const value = useMemo<ContextValue>(
    () => ({
      current,
      playlist,
      match,
      matchLoading,
      mode,

      play,
      pause: player.pause,
      resume: player.play,
      toggle: player.toggle,
      next,
      prev,
      close,
      expand,
      collapse,
      seekPercent: player.seekPercent,

      isReady: player.isReady,
      isPlaying: player.isPlaying,
      progress: player.progress,
      currentSec: player.currentSec,
      durationSec: player.durationSec,
      containerRef: player.containerRef,
    }),
    [
      current,
      playlist,
      match,
      matchLoading,
      mode,
      play,
      next,
      prev,
      close,
      expand,
      collapse,
      player.pause,
      player.play,
      player.toggle,
      player.seekPercent,
      player.isReady,
      player.isPlaying,
      player.progress,
      player.currentSec,
      player.durationSec,
      player.containerRef,
    ],
  );

  // 모드에 따라 IFrame 컨테이너의 위치/크기 결정.
  // 풀 모드: 화면 중앙에 크게 (영상 메인 노출 — 약관 준수)
  // 미니 모드: 화면 우측 하단에 PIP 처럼 작게 (영상이 계속 보임)
  // 숨김 모드: 화면 밖
  const stageClass =
    mode === "full"
      ? "fixed left-1/2 top-[12vh] z-[110] aspect-video w-[92vw] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
      : mode === "mini"
        ? "fixed bottom-36 right-3 z-[95] aspect-video w-[140px] sm:bottom-40 sm:right-4 sm:w-[180px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15"
        : "fixed -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden";

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {/*
       * YouTube IFrame 무대 — 라우트가 바뀌어도 같은 노드가 유지되어야 재생이 끊기지 않는다.
       * 모드에 따라 위치/크기만 부드럽게 전환한다. YouTube 약관 준수를 위해 영상은
       * 어느 모드에서도 시각적으로 노출된다(숨김 모드는 곡이 없을 때만).
       */}
      <div
        className={`${stageClass} transition-all duration-300 ease-out bg-black`}
        aria-hidden={mode === "hidden"}
      >
        {/* 실제 IFrame 이 들어가는 자리 — pointer-events 활성으로 두어
            사용자가 영상을 정상적으로 인터랙션할 수 있게 한다 (약관 준수) */}
        <div ref={player.containerRef} className="absolute inset-0" />
      </div>
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer(): ContextValue {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error("useMusicPlayer 는 MusicPlayerProvider 안에서만 사용 가능합니다.");
  }
  return ctx;
}
