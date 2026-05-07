"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, X, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";

import { apiFetch } from "../../lib/api";
import { MusicTrack, MatchResult, PopupMatch } from "../../types/music";
import { useYouTubePlayer } from "./useYouTubePlayer";

interface Props {
  track: MusicTrack | null;
  playlist?: MusicTrack[];        // 다음 곡 전환용 (선택)
  onClose: () => void;
  onChangeTrack?: (t: MusicTrack) => void;
}

/** 진행 시간 mm:ss */
function fmt(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicPlayerModal({ track, playlist, onClose, onChangeTrack }: Props) {
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const player = useYouTubePlayer({
    videoId: track?.youtubeVideoId ?? null,
    onEnded: () => {
      // 자동 다음곡
      if (!playlist || !track || !onChangeTrack) return;
      const idx = playlist.findIndex((p) => p.id === track.id);
      const next = playlist[idx + 1];
      if (next) onChangeTrack(next);
    },
  });

  // 트랙 바뀔 때 분위기 분석 + 팝업 매칭
  useEffect(() => {
    if (!track) return;
    setMatch(null);
    setMatchLoading(true);
    apiFetch(`/api/music/${track.id}/play`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MatchResult | null) => setMatch(data))
      .catch(() => null)
      .finally(() => setMatchLoading(false));
  }, [track]);

  const goPrev = () => {
    if (!playlist || !track || !onChangeTrack) return;
    const idx = playlist.findIndex((p) => p.id === track.id);
    const prev = playlist[idx - 1];
    if (prev) onChangeTrack(prev);
  };

  const goNext = () => {
    if (!playlist || !track || !onChangeTrack) return;
    const idx = playlist.findIndex((p) => p.id === track.id);
    const next = playlist[idx + 1];
    if (next) onChangeTrack(next);
  };

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col bg-black"
          aria-modal="true"
          role="dialog"
        >
          {/* 블러 배경 — 앨범아트 */}
          {track.artworkUrlHires && (
            <div
              className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-50"
              style={{ backgroundImage: `url(${track.artworkUrlHires})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/80" />

          {/* 닫기 */}
          <button
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-4 top-4 z-20 grid place-items-center rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          {/* 콘텐츠 */}
          <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-6 py-12">
            {/* 앨범아트 */}
            <motion.img
              key={track.id}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              src={track.artworkUrlHires || track.artworkUrl}
              alt={track.trackName}
              className="aspect-square w-64 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 sm:w-80"
            />

            {/* 곡 정보 */}
            <div className="mt-8 max-w-md text-center text-white">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{track.trackName}</h1>
              <p className="mt-1 text-base text-white/70">{track.artistName}</p>
              {track.albumName && (
                <p className="mt-0.5 text-sm text-white/40">{track.albumName}</p>
              )}
            </div>

            {/* 진행바 (자체) */}
            <div className="mt-8 flex w-full max-w-md flex-col gap-2">
              <div
                className="group h-1.5 cursor-pointer rounded-full bg-white/15"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left) / rect.width) * 100;
                  player.seekPercent(pct);
                }}
              >
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${player.progress}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[11px] text-white/50">
                <span>{fmt(player.currentSec)}</span>
                <span>{fmt(player.durationSec)}</span>
              </div>
            </div>

            {/* 컨트롤 (자체) */}
            <div className="mt-6 flex items-center gap-8 text-white">
              <button
                onClick={goPrev}
                disabled={!playlist}
                className="rounded-full p-2 transition hover:bg-white/10 disabled:opacity-30"
                aria-label="이전 곡"
              >
                <SkipBack className="h-7 w-7" />
              </button>
              <button
                onClick={player.toggle}
                disabled={!player.isReady}
                className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-2xl transition hover:scale-105 disabled:opacity-50"
                aria-label={player.isPlaying ? "일시정지" : "재생"}
              >
                {player.isPlaying ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="ml-1 h-8 w-8" />
                )}
              </button>
              <button
                onClick={goNext}
                disabled={!playlist}
                className="rounded-full p-2 transition hover:bg-white/10 disabled:opacity-30"
                aria-label="다음 곡"
              >
                <SkipForward className="h-7 w-7" />
              </button>
            </div>

            {/* 매칭된 팝업 */}
            <div className="mt-12 w-full max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-lime-300" />
                <h2 className="text-sm font-bold uppercase tracking-widest">
                  이 곡 분위기에 어울리는 팝업
                </h2>
              </div>

              {match?.moodTags && match.moodTags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {match.moodTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80 backdrop-blur"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {matchLoading && (
                <p className="text-sm text-white/50">분위기 분석 중...</p>
              )}

              {match && match.popups.length === 0 && (
                <p className="text-sm text-white/50">매칭된 팝업이 없어요.</p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {match?.popups.map((p: PopupMatch) => (
                  <Link
                    key={p.popupId}
                    href={`/popup/${p.popupId}`}
                    className="group flex gap-3 rounded-xl bg-white/5 p-3 backdrop-blur transition hover:bg-white/10"
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1 text-white">
                      <h3 className="truncate text-sm font-bold">{p.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/60">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {p.location}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-lime-300/20 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                        🎯 {p.score}% 매칭
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* 출처 표기 (YouTube TOS 의무) */}
            <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-white/30">
              Powered by YouTube
            </p>
          </div>

          {/* 숨겨진 IFrame — 오디오만 재생 */}
          <div
            ref={player.containerRef}
            className="pointer-events-none absolute -left-[9999px] -top-[9999px] h-0 w-0 opacity-0"
            aria-hidden
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
