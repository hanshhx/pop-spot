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
import { useSpotifyAuth } from '@/features/music/useSpotifyAuth';
import type { MatchResult, MusicTrack } from '@/types/music';
import { useYouTubePlayer, describeYouTubeError } from './useYouTubePlayer';
import { usePreviewPlayer } from './usePreviewPlayer';
import { useSpotifyPlayer } from './useSpotifyPlayer';

/** v2.21-S13 — 재생 엔진 종류. 우선순위 spotify > preview > youtube. */
type PlaybackEngine = 'spotify' | 'preview' | 'youtube';

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

  // v2.21-S13 — Spotify 연결 / Premium 상태 (3-tier 엔진 결정에 사용).
  const spotifyAuth = useSpotifyAuth();

  /**
   * v2.21-S13 — 재생 엔진 결정.
   *
   * <ul>
   *   <li>spotify — Premium 연결 + 데스크탑 + spotify trackId (itunesTrackId 가 실제 Spotify ID)
   *   <li>preview — Spotify preview_url 있음 (Free / 미연결 / 모바일)
   *   <li>youtube — 위 둘 다 불가 (preview 없는 인디 곡 등)
   * </ul>
   *
   * <p>SDK 는 데스크탑 전용이라 모바일이면 spotify 엔진 제외.
   */
  const engine: PlaybackEngine = useMemo(() => {
    if (!current) return 'youtube';
    const isMobile =
      typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (spotifyAuth.connected && spotifyAuth.isPremium && !isMobile && current.itunesTrackId) {
      return 'spotify';
    }
    if (current.previewUrl) return 'preview';
    return 'youtube';
  }, [current, spotifyAuth.connected, spotifyAuth.isPremium]);

  const yt = useYouTubePlayer({
    videoId: engine === 'youtube' ? current?.youtubeVideoId ?? null : null,
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
        text: `"${failed.trackName ?? "이 곡"}" — ${reason}`,
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

  const previewPlayer = usePreviewPlayer({
    previewUrl: engine === 'preview' ? current?.previewUrl ?? null : null,
    enabled: engine === 'preview',
    onEnded: () => playNextFromQueue(),
  });

  const spotifyPlayer = useSpotifyPlayer({
    spotifyTrackId: engine === 'spotify' ? current?.itunesTrackId ?? null : null,
    enabled: engine === 'spotify',
    onEnded: () => playNextFromQueue(),
  });

  // 활성 엔진의 신호/컨트롤로 통합. preview 는 isReady 개념 없어 항상 true.
  const player = useMemo(() => {
    if (engine === 'spotify') {
      return { ...spotifyPlayer, containerRef: yt.containerRef };
    }
    if (engine === 'preview') {
      return { ...previewPlayer, isReady: true, containerRef: yt.containerRef };
    }
    return yt;
  }, [engine, spotifyPlayer, previewPlayer, yt]);

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

  // v2.21-S9 — 백엔드가 강력 필터 (cover/live/piano/lullaby/nightcore 등 50개) 로 공식 음원
  // 매칭에 실패하면 youtubeVideoId 가 null 인 채로 응답. 그 상태에선 YouTube IFrame 이
  // 안 뜨고 검은 화면. 사용자에게 토스트 + 자동 skip 으로 graceful 처리.
  const noMatchHandledRef = useRef<number | null>(null);
  useEffect(() => {
    if (!current) {
      noMatchHandledRef.current = null;
      return;
    }
    // v2.21-S13 — preview / spotify 엔진은 youtubeVideoId 없이도 재생 가능.
    // youtube 엔진일 때만 매칭 0 (검은 화면) 을 skip 처리.
    if (engine !== 'youtube') {
      noMatchHandledRef.current = null;
      return;
    }
    if (matchLoading) return; // 백엔드가 youtube_video_id 채우는 중일 수 있음 — 기다림
    if (current.youtubeVideoId) {
      noMatchHandledRef.current = null;
      return;
    }
    // 매칭 0 — 같은 trackId 중복 처리 방지
    if (noMatchHandledRef.current === current.id) return;
    noMatchHandledRef.current = current.id;

    notify({
      icon: 'info',
      title: '공식 음원을 찾지 못했어요',
      text: `"${current.trackName ?? '이 곡'}" — 다음 곡으로 넘어갑니다`,
      timer: 2500,
    });
    playNextFromQueue();
  }, [current, matchLoading, playNextFromQueue, engine]);

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
       *
       * v2.21-S13 — preview / spotify 엔진은 영상이 없으므로 stage 를 hidden 으로 숨긴다.
       * (GlobalMusicPlayer 의 미니/풀 컨트롤은 앨범 커버 기반으로 별도 표시.)
       */}
      <div
        className={`${
          engine === 'youtube' ? resolveStageClass(mode) : STAGE_HIDDEN_CLASS
        } transition-all duration-300 ease-out bg-black`}
        aria-hidden={mode === 'hidden' || engine !== 'youtube'}
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
