"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Dice5,
  Flame,
  Loader2,
  Music2,
  Play,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { SpotifyConnectButton } from "@/features/music/SpotifyConnectButton";
import { MatchResult, MusicTrack } from "@/types/music";
import { useMusicPlayer } from "./MusicPlayerProvider";

/**
 * 검색 디바운스 — 입력이 멈추고 N ms 후 한 번만 호출.
 * IME 조합 중에는 effect 가 흘러도 value 자체는 안정적이라 추가 처리 불필요.
 */
function useDebounce<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** 카테고리는 프론트에서 정의 — 백엔드는 keyword 만 받아서 검색 수행 */
const CATEGORIES: { id: string; label: string; keyword: string }[] = [
  { id: "summer", label: "여름밤", keyword: "summer night" },
  { id: "rainy", label: "비 오는 날", keyword: "rainy day" },
  { id: "study", label: "공부할 때", keyword: "study lofi" },
  { id: "workout", label: "운동", keyword: "workout pump" },
  { id: "drive", label: "드라이브", keyword: "driving korean indie" },
  { id: "kpop", label: "K-POP", keyword: "k-pop hits" },
  { id: "indie", label: "한국 인디", keyword: "korean indie" },
  { id: "ballad", label: "발라드", keyword: "korean ballad" },
  { id: "rnb", label: "R&B", keyword: "korean rnb" },
  { id: "ost", label: "OST", keyword: "korean drama ost" },
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

  // 입력값과, 실제 검색어로 확정된 값(자동완성 클릭 또는 Enter 시점)을 분리.
  // 자동완성이 사용자 의도를 정확한 텍스트로 만들어주므로
  // 검색 자체는 "확정된 검색어"가 들어왔을 때만 일어난다.
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

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

  // 자동완성 — 입력하는 동안 백엔드 /suggest 호출
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    apiFetch(`/api/music/suggest?q=${encodeURIComponent(q)}&limit=8`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: string[]) => {
        setSuggestions(data || []);
        setActiveIndex(-1);
      })
      .catch(() => setSuggestions([]));
  }, [debouncedQuery]);

  // 입력만 해도 자동으로 검색 결과 그리드를 채운다 (자동완성과 별개).
  // 사용자가 굳이 후보를 클릭/Enter 안 해도 결과가 보이고,
  // 더 정확한 결과를 원하면 드롭다운 후보를 클릭해서 갈아탈 수 있다.
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSubmittedQuery("");
      return;
    }
    setSubmittedQuery(q);
    setActiveCategory(null);
  }, [debouncedQuery]);

  // 확정된 검색어로 실제 곡 검색
  useEffect(() => {
    const q = submittedQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    apiFetch(`/api/music/search?q=${encodeURIComponent(q)}&limit=18`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => setResults(data || []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [submittedQuery]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestBoxRef.current &&
        !suggestBoxRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const submitSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    setSuggestOpen(false);
    setActiveCategory(null);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || suggestions.length === 0) {
      if (e.key === "Enter") submitSearch(query);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeIndex >= 0 ? suggestions[activeIndex] : query;
      submitSearch(target);
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
    }
  };

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

  const showResults = submittedQuery.trim().length > 0;
  const showCategory = !showResults && activeCategory != null;

  const display: MusicTrack[] = showResults
    ? results
    : showCategory
      ? categoryTracks
      : popular;

  const sectionTitle = useMemo(() => {
    if (showResults) return `검색 "${submittedQuery}"`;
    if (showCategory) {
      const c = CATEGORIES.find((x) => x.id === activeCategory);
      return c ? c.label : "";
    }
    return "지금 인기있는 곡";
  }, [showResults, showCategory, submittedQuery, activeCategory]);

  return (
    <div className="relative min-h-[80vh] w-full">
      {/* 헤더 */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              POP · MUSIC
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
              듣고 있던 곡으로,{" "}
              <span className="text-lime-500 dark:text-lime-300">팝업을 골라봐요</span>
            </h2>
          </div>
          {/* v2.21-S11 — Spotify 연결 칩. Premium 이면 풀트랙, Free/미연결은 30초 미리듣기. */}
          <div className="shrink-0 pt-1">
            <SpotifyConnectButton />
          </div>
        </div>
      </header>

      {/* 검색 + 룰렛/패스포트 */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveCategory(null);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="아티스트, 곡명으로 검색"
            className="h-12 w-full rounded-pill border border-[var(--color-border)] bg-cream-200 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-lime-400 focus:outline-none dark:bg-ink-800"
            autoComplete="off"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}

          {/* 자동완성 드롭다운 */}
          {suggestOpen && suggestions.length > 0 && (
            <div
              ref={suggestBoxRef}
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface shadow-pop"
            >
              {suggestions.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => submitSearch(s)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                    activeIndex === i
                      ? "bg-foreground/5 text-foreground"
                      : "text-foreground/80 hover:bg-foreground/5"
                  }`}
                >
                  <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
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
                className={`rounded-pill border px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-lime-400 bg-lime-300 text-ink-900"
                    : "border-[var(--color-border)] bg-cream-200 text-foreground hover:bg-cream-300 dark:bg-ink-800 dark:hover:bg-ink-700"
                }`}
              >
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
          // Spotify/iTunes CDN 이미지 — next/image 도메인 화이트리스트 대신 <img> 사용.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.artworkUrlHires || track.artworkUrl}
            alt={track.trackName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Music2 className="h-8 w-8" />
          </div>
        )}

        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent opacity-0 transition group-hover:opacity-100">
          <div className="flex w-full items-center justify-end p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lime-300 text-ink-900 shadow-xl">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
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
