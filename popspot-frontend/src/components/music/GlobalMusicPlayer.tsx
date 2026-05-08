"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";

import { PopupMatch } from "@/types/music";
import { useMusicPlayer } from "./MusicPlayerProvider";

function formatSeconds(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * 전역 음악 플레이어 UI.
 *
 * 두 가지 모드:
 *   - mini : 화면 하단 바 (어떤 페이지에서든 떠 있음)
 *   - full : 풀스크린 모달 (앨범아트 + 컨트롤 + 매칭된 팝업)
 *
 * 라우트 이동에 영향을 안 받고 항상 같은 자리에 떠있도록
 * RootLayout 안에서 한 번만 렌더한다.
 */
export function GlobalMusicPlayer() {
  const player = useMusicPlayer();
  const { current, mode } = player;

  if (!current || mode === "hidden") return null;

  return (
    <>
      <AnimatePresence>{mode === "full" && <FullScreenPlayer />}</AnimatePresence>
      <AnimatePresence>{mode === "mini" && <MiniPlayerBar />}</AnimatePresence>
    </>
  );
}

/* ---------------- Mini Player (화면 하단 바) ---------------- */

function MiniPlayerBar() {
  const {
    current,
    isPlaying,
    progress,
    toggle,
    next,
    prev,
    expand,
    close,
    match,
  } = useMusicPlayer();
  if (!current) return null;

  const topPopup = match?.popups?.[0];

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-20 left-1/2 z-[90] w-[95%] max-w-[480px] -translate-x-1/2 md:bottom-24 md:max-w-[600px]"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface/95 shadow-pop backdrop-blur-md">
        {/* 진행바 */}
        <div className="h-0.5 w-full bg-foreground/10">
          <div
            className="h-full bg-lime-300 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={expand}
            className="flex flex-1 items-center gap-3 text-left"
            aria-label="전체화면으로 보기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.artworkUrl || current.artworkUrlHires}
              alt={current.trackName}
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {current.trackName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {current.artistName}
              </p>
            </div>
            <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={prev}
            aria-label="이전 곡"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground transition hover:bg-foreground/10"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "일시정지" : "재생"}
            className="grid h-10 w-10 place-items-center rounded-full bg-lime-300 text-ink-900 shadow-sm transition hover:scale-105"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="다음 곡"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground transition hover:bg-foreground/10"
          >
            <SkipForward className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="플레이어 닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 매칭된 팝업 1순위만 살짝 노출 — 가벼운 디스커버리용 */}
        {topPopup && (
          <Link
            href={`/popup/${topPopup.popupId}`}
            className="flex items-center gap-2 border-t border-[var(--color-border)] bg-foreground/[0.03] px-3 py-2 text-xs transition hover:bg-foreground/[0.06]"
          >
            <Sparkles className="h-3 w-3 text-lime-500" />
            <span className="truncate text-muted-foreground">
              <span className="font-bold text-foreground">{topPopup.name}</span>
              <span className="ml-1.5">· 이 곡 분위기와 {topPopup.score}% 매칭</span>
            </span>
            <MapPin className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

/* ---------------- Full-Screen Player ---------------- */

function FullScreenPlayer() {
  const {
    current,
    isPlaying,
    progress,
    currentSec,
    durationSec,
    toggle,
    next,
    prev,
    seekPercent,
    collapse,
    match,
    matchLoading,
  } = useMusicPlayer();
  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
    >
      {current.artworkUrlHires && (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-3xl"
          style={{ backgroundImage: `url(${current.artworkUrlHires})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />

      <button
        type="button"
        onClick={collapse}
        aria-label="미니 플레이어로 줄이기"
        className="absolute right-4 top-4 z-20 grid place-items-center rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
      >
        <ChevronDown className="h-6 w-6" />
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-6 py-12">
        <motion.img
          key={current.id}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          src={current.artworkUrlHires || current.artworkUrl}
          alt={current.trackName}
          className="aspect-square w-64 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 sm:w-80"
        />

        <div className="mt-8 max-w-md text-center text-white">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {current.trackName}
          </h1>
          <p className="mt-1 text-base text-white/70">{current.artistName}</p>
          {current.albumName && (
            <p className="mt-0.5 text-sm text-white/40">{current.albumName}</p>
          )}
        </div>

        <div className="mt-8 flex w-full max-w-md flex-col gap-2">
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="group h-1.5 cursor-pointer rounded-full bg-white/15"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              seekPercent(pct);
            }}
          >
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[11px] text-white/50">
            <span>{formatSeconds(currentSec)}</span>
            <span>{formatSeconds(durationSec)}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-8 text-white">
          <button
            type="button"
            onClick={prev}
            className="rounded-full p-2 transition hover:bg-white/10"
            aria-label="이전 곡"
          >
            <SkipBack className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-2xl transition hover:scale-105"
            aria-label={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="ml-1 h-8 w-8" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-full p-2 transition hover:bg-white/10"
            aria-label="다음 곡"
          >
            <SkipForward className="h-7 w-7" />
          </button>
        </div>

        {/* 매칭된 팝업 */}
        <section className="mt-12 w-full max-w-3xl">
          <header className="mb-3 flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-lime-300" />
            <h2 className="text-sm font-bold uppercase tracking-widest">
              이 곡 분위기에 어울리는 팝업
            </h2>
          </header>

          {match?.moodTags && match.moodTags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {match.moodTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80 backdrop-blur"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {matchLoading && (
            <p className="text-sm text-white/50">분위기 분석 중...</p>
          )}

          {match && match.popups.length === 0 && !matchLoading && (
            <p className="text-sm text-white/50">매칭된 팝업이 아직 없어요.</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {match?.popups.map((popup: PopupMatch) => (
              <Link
                key={popup.popupId}
                href={`/popup/${popup.popupId}`}
                onClick={collapse}
                className="group flex gap-3 rounded-xl bg-white/5 p-3 backdrop-blur transition hover:bg-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={popup.imageUrl}
                  alt={popup.name}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1 text-white">
                  <h3 className="truncate text-sm font-bold">{popup.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/60">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {popup.location}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-lime-300/20 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                    매칭 {popup.score}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-white/30">
          Search · Spotify &nbsp;·&nbsp; Playback · YouTube
        </p>
      </div>
    </motion.div>
  );
}
