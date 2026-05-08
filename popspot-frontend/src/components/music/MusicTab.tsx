"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dice5, Flame, Loader2, Search, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { MatchResult, MusicTrack } from "@/types/music";
import { useMusicPlayer } from "./MusicPlayerProvider";

/**
 * 검색 디바운스 — 입력이 멈추고 350ms 후 한 번만 호출.
 * IME 조합 중에는 effect 가 흘러도 query 자체는 안정적이라 추가 처리 불필요.
 */
function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** 카테고리는 프론트에서 정의 — 백엔드는 keyword 만 받아서 검색 수행 */
const CATEGORIES: { id: string; label: string; keyword: string; emoji: string }[] = [
  { id: "summer", label: "여름밤", keyword: "summer night", emoji: "🌃" },
  { id: "rainy", label: "비 오는 날", keyword: "rainy day", emoji: "🌧️" },
  { id: "study", label: "공부할 때", keyword: "study lofi", emoji: "📚" },
  { id: "workout", label: "운동", keyword: "workout pump", emoji: "💪" },
  { id: "drive", label: "드라이브", keyword: "driving korean indie", emoji: "🚗" },
  { id: "kpop", label: "K-POP", keyword: "k-pop hits", emoji: "🎤" },
  { id: "indie", label: "한국 인디", keyword: "korean indie", emoji: "🎸" },
  { id: "ballad", label: "발라드", keyword: "korean ballad", emoji: "💧" },
  { id: "rnb", label: "R&B", keyword: "korean rnb", emoji: "🌙" },
  { id: "ost", label: "OST", keyword: "korean drama ost", emoji: "🎬" },
];

/**
 * 홈 화면의 MUSIC 탭.
 *
 * - 검색 그리드 (Spotify)
 * - 카테고리/무드 그리드
 * - 인기 차트
 * - 운명의 곡 룰렛, 음악 패스포트 진입
 */
export default function MusicTab() {
  const player = useMusicPlayer();

  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 350);

  const [popular, setPopular] = useState<MusicTrack[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);

  const [results, setResults] = useState<MusicTrack[]>([]);
  const [searching, setSearching] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryTracks, setCategoryTracks] = useState<MusicTrack[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [rouletteLoading, setRouletteLoading] = useState(false);

  useEffect(() => {
    setPopularLoading(true);
    apiFetch("/api/music/popular?limit=18")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => setPopular(data || []))
      .catch(() => setPopular([]))
      .finally(() => setPopularLoading(false));
  }, []);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    apiFetch(`/api/music/search?q=${encodeURIComponent(debounced)}&limit=18`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => setResults(data || []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debounced]);

  const handleCategory = async (id: string, keyword: string) => {
    setActiveCategory(id);
    setCategoryLoading(true);
    try {
      const r = await apiFetch(
        `/api/music/category?keyword=${encodeURIComponent(keyword)}&limit=18`,
      );
      const data: MusicTrack[] = r.ok ? await r.json() : [];
      setCategoryTracks(data || []);
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleRoulette = async () => {
    setRouletteLoading(true);
    try {
      const r = await apiFetch("/api/music/roulette", { method: "POST" });
      if (!r.ok) return;
      const data: MatchResult = await r.json();
      if (data?.track) player.play(data.track);
    } finally {
      setRouletteLoading(false);
    }
  };

  const showResults = debounced.trim().length > 0;
  const showCategory = !showResults && activeCategory != null;

  const display: MusicTrack[] = showResults
    ? results
    : showCategory
      ? categoryTracks
      : popular;

  const sectionTitle = useMemo(() => {
    if (showResults) return `검색 "${debounced}"`;
    if (showCategory) {
      const c = CATEGORIES.find((x) => x.id === activeCategory);
      return c ? `${c.emoji} ${c.label}` : "";
    }
    return "지금 인기있는 곡";
  }, [showResults, showCategory, debounced, activeCategory]);

  return (
    <div className="relative min-h-[80vh] w-full">
      {/* 헤더 */}
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-lime-500/80 dark:text-lime-300/80">
          Music meets Popups
        </p>
        <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
          지금 듣는 노래에 어울리는{" "}
          <span className="bg-gradient-to-r from-lime-400 to-emerald-400 bg-clip-text text-transparent">
            팝업스토어
          </span>
        </h2>
      </header>

      {/* 검색 + 룰렛/패스포트 */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveCategory(null);
            }}
            placeholder="아티스트, 곡명으로 검색"
            className="h-12 w-full rounded-pill border border-[var(--color-border)] bg-cream-200 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-lime-400 focus:outline-none dark:bg-ink-800"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <button
          type="button"
          onClick={handleRoulette}
          disabled={rouletteLoading}
          className="flex h-12 items-center justify-center gap-2 rounded-pill bg-gradient-to-r from-lime-400 to-emerald-400 px-5 text-sm font-black text-ink-900 transition hover:scale-[1.02] disabled:opacity-60"
        >
          {rouletteLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Dice5 className="h-4 w-4" />
          )}
          운명의 곡
        </button>
        <Link
          href="/music/passport"
          className="flex h-12 items-center justify-center gap-2 rounded-pill border border-[var(--color-border)] bg-cream-200 px-5 text-sm font-bold text-foreground transition hover:bg-cream-300 dark:bg-ink-800 dark:hover:bg-ink-700"
        >
          <Ticket className="h-4 w-4" />
          패스포트
        </Link>
      </div>

      {/* 카테고리 칩 */}
      {!showResults && (
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = c.id === activeCategory;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCategory(c.id, c.keyword)}
                className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-lime-400 bg-lime-300 text-ink-900"
                    : "border-[var(--color-border)] bg-cream-200 text-foreground hover:bg-cream-300 dark:bg-ink-800 dark:hover:bg-ink-700"
                }`}
              >
                <span>{c.emoji}</span>
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 섹션 헤더 */}
      <div className="mb-4 flex items-center gap-2">
        {showResults ? (
          <Search className="h-4 w-4 text-lime-500" />
        ) : showCategory ? (
          <Sparkles className="h-4 w-4 text-lime-500" />
        ) : (
          <Flame className="h-4 w-4 text-orange-400" />
        )}
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
          {sectionTitle}
        </h3>
      </div>

      {/* 그리드 */}
      {(popularLoading && !showResults && !showCategory) ||
      (categoryLoading && showCategory) ? (
        <SkeletonGrid />
      ) : display.length === 0 ? (
        <EmptyState searched={showResults} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-6">
          {display.map((t, i) => (
            <TrackCard
              key={t.id}
              track={t}
              index={i}
              onPlay={() => player.play(t, display)}
            />
          ))}
        </div>
      )}

      <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Search · Spotify &nbsp;·&nbsp; Playback · YouTube
      </p>
    </div>
  );
}

/* -------------------- 작은 부속 컴포넌트들 -------------------- */

function TrackCard({
  track,
  index,
  onPlay,
}: {
  track: MusicTrack;
  index: number;
  onPlay: () => void;
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      onClick={onPlay}
      className="group text-left"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-foreground/5 ring-1 ring-[var(--color-border)] transition group-hover:ring-foreground/30">
        {track.artworkUrlHires || track.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.artworkUrlHires || track.artworkUrl}
            alt={track.trackName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full place-items-center text-3xl text-muted-foreground">
            ♪
          </div>
        )}

        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent opacity-0 transition group-hover:opacity-100">
          <div className="flex w-full items-center justify-end p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lime-300 text-ink-900 shadow-xl">
              ▶
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-bold text-foreground">
          {track.trackName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artistName}
        </p>
      </div>
    </motion.button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-square animate-pulse rounded-xl bg-foreground/5" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-foreground/5" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-foreground/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-cream-200 px-6 py-16 text-center dark:bg-ink-800">
      <p className="text-sm font-bold text-foreground">
        {searched ? "검색 결과가 없어요" : "아직 인기곡 데이터가 부족해요"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {searched
          ? "다른 키워드로 시도해보세요"
          : "검색하거나 카테고리를 골라보세요"}
      </p>
    </div>
  );
}
