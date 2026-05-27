'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { apiFetch } from '@/lib/api';
import { notify } from '@/lib/notify';
import type { MatchResult, MusicTrack } from '@/types/music';
import { useYouTubePlayer, describeYouTubeError } from './useYouTubePlayer';

/**
 * 글로벌 음악 플레이어 Provider.
 *
 * <p>라우트 이동에 영향 받지 않게 layout 최상단에 두고, 어떤 페이지에서든 {@link useMusicPlayer} 로
 * 동일한 인스턴스를 사용한다.
 *
 * <p>큐 관리:
 * <ul>
 *   <li>{@code playlist} — 사용자가 보고 있는 그리드 (검색 / 카테고리 / 인기)
 *   <li>{@code autoQueue} — 곡 종료 시 자동으로 이어 재생할 추천 큐
 * </ul>
 *
 * <p>모드: hidden / mini (PIP) / full (중앙 크게). YouTube 약관 준수를 위해 영상은 mini 모드에서도
 * 시각적으로 노출된다 (hidden 은 곡이 없을 때만).
 */

type Mode = 'hidden' | 'mini' | 'full';

const AUTO_QUEUE_LIMIT = 8;

const STAGE_FULL_CLASS =
  'fixed left-1/2 top-[12vh] z-[110] aspect-video w-[92vw] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10';
const STAGE_MINI_CLASS =
  'fixed bottom-36 right-3 z-[95] aspect-video w-[140px] sm:bottom-40 sm:right-4 sm:w-[180px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15';
const STAGE_HIDDEN_CLASS = 'fixed -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden';

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
  containerRef: RefObject<HTMLDivElement | null>;
}

type ContextValue = MusicPlayerState & MusicPlayerActions & PlayerSignals;

const MusicPlayerContext = createContext<ContextValue | null>(null);

const resolveStageClass = (mode: Mode): string => {
  if (mode === 'full') return STAGE_FULL_CLASS;
  if (mode === 'mini') return STAGE_MINI_CLASS;
  return STAGE_HIDDEN_CLASS;
};

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<MusicTrack | null>(null);
  const [playlist, setPlaylist] = useState<MusicTrack[]>([]);
  const [autoQueue, setAutoQueue] = useState<MusicTrack[]>([]);
  const [mode, setMode] = useState<Mode>('hidden');

  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  // 추천 큐가 비어가면 미리 다음 곡들을 보충해서 끊김 없이 이어지게 한다.
  const refillingRef = useRef(false);

  // v2.21-S6 — 재생 실패 시 같은 곡을 즉시 재시도하지 않도록 차단 (무한 루프 방지).
  // current trackId 가 바뀔 때만 다시 0 으로 리셋.
  const skippedTrackIdRef = useRef<number | null>(null);

  const player = useYouTubePlayer({
    videoId: current?.youtubeVideoId ?? null,
    onEnded: () => playNextFromQueue(),
    onError: (code) => {
      const failed = current;
      if (!failed) return;
      // 무한 skip 루프 방지 — 같은 trackId 가 또 실패하면 한 번만 처리.
      if (skippedTrackIdRef.current === failed.id) return;
      skippedTrackIdRef.current = failed.id;

      const reason = describeYouTubeError(code);
      notify({
        icon: "info",
        title: "다음 곡으로 넘어가요",
        text: `"${failed.title ?? "이 곡"}" — ${reason}`,
        timer: 2500,
      });

      // 백엔드에 실패 마킹 — 다음에 같은 트랙이 후보로 안 나오게.
      apiFetch(`/api/music/${failed.id}/playback-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).catch(() => {
        /* 마킹 실패는 무시 — 다음 트랙 진행이 더 중요 */
      });

      playNextFromQueue();
    },
  });

  /* ============================== Actions ============================== */

  const refillAutoQueue = useCallback(async (seedId: number) => {
    if (refillingRef.current) return;
    refillingRef.current = true;
    try {
      const res = await apiFetch(`/api/music/${seedId}/next?limit=${AUTO_QUEUE_LIMIT}`);
      if (!res.ok) return;
      const list = (await res.json()) as MusicTrack[];
      setAutoQueue(list ?? []);
    } catch {
      // 큐가 비어도 끝나는 거지 치명적 에러는 아님 — 무시.
    } finally {
      refillingRef.current = false;
    }
  }, []);

  const fetchMatchResult = useCallback(async (trackId: number) => {
    setMatch(null);
    setMatchLoading(true);
    try {
      const res = await apiFetch(`/api/music/${trackId}/play`, { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as MatchResult | null;
      if (!data) return;
      setMatch(data);
      // 백엔드가 lazy fetch 로 youtube_video_id 를 채워서 보내준다.
      // 그 갱신된 track 으로 current 를 덮어써야 IFrame 이 영상을 로드한다.
      if (data.track) setCurrent(data.track);
    } catch {
      // 매칭 실패는 재생 흐름에 영향 X — 무시.
    } finally {
      setMatchLoading(false);
    }
  }, []);

  const play = useCallback(
    (track: MusicTrack, list?: MusicTrack[]) => {
      setCurrent(track);
      if (list && list.length > 0) setPlaylist(list);
      setMode((prev) => (prev === 'hidden' ? 'full' : prev));

      void fetchMatchResult(track.id);
      void refillAutoQueue(track.id);
    },
    [fetchMatchResult, refillAutoQueue],
  );

  const playNextFromQueue = useCallback(() => {
    if (!current) return;

    // 사용자가 보고 있던 그리드에서 다음 곡이 있으면 우선 재생.
    const idx = playlist.findIndex((t) => t.id === current.id);
    const next = playlist[idx + 1];
    if (next) {
      play(next, playlist);
      return;
    }

    // 그렇지 않으면 추천 큐로 이어 재생.
    if (autoQueue.length > 0) {
      const [head, ...rest] = autoQueue;
      setAutoQueue(rest);
      play(head);
    }
  }, [current, playlist, autoQueue, play]);

  const prev = useCallback(() => {
    if (!current || playlist.length === 0) return;
    const idx = playlist.findIndex((t) => t.id === current.id);
    const before = playlist[idx - 1];
    if (before) play(before, playlist);
  }, [current, playlist, play]);

  const close = useCallback(() => {
    setMode('hidden');
    setCurrent(null);
    setMatch(null);
    setAutoQueue([]);
    player.pause();
  }, [player]);

  const expand = useCallback(() => setMode('full'), []);
  const collapse = useCallback(() => setMode('mini'), []);

  // 곡이 처음 들어왔는데 mode 가 hidden 이면 곧바로 풀 화면으로 띄운다.
  useEffect(() => {
    if (current && mode === 'hidden') setMode('full');
  }, [current, mode]);

  /* ============================== Context value ============================== */

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
      next: playNextFromQueue,
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
      playNextFromQueue,
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

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {/*
       * YouTube IFrame 무대 — 라우트가 바뀌어도 같은 노드가 유지되어야 재생이 끊기지 않는다.
       * 모드에 따라 위치 / 크기만 부드럽게 전환된다. YouTube 약관 III.E.4.b 준수를 위해 영상은
       * 어느 모드에서도 시각적으로 노출된다 (hidden 은 곡이 없을 때뿐).
       */}
      <div
        className={`${resolveStageClass(mode)} transition-all duration-300 ease-out bg-black`}
        aria-hidden={mode === 'hidden'}
      >
        <div ref={player.containerRef} className="absolute inset-0" />
      </div>
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer(): ContextValue {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error('useMusicPlayer 는 MusicPlayerProvider 안에서만 사용 가능합니다.');
  }
  return ctx;
}
