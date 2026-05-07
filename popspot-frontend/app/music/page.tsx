"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Play,
  ArrowLeft,
  Sparkles,
  Flame,
  Dice5,
  Ticket as TicketIcon,
  Loader2,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { MusicTrack } from "@/types/music";
import MusicPlayerModal from "@/components/music/MusicPlayerModal";

/** 검색 디바운스 */
function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function MusicPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 350);

  const [popular, setPopular] = useState<MusicTrack[]>([]);
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [popularLoading, setPopularLoading] = useState(true);

  const [active, setActive] = useState<MusicTrack | null>(null);
  const [rouletteLoading, setRouletteLoading] = useState(false);

  // 인기 트랙 로드
  useEffect(() => {
    setPopularLoading(true);
    apiFetch("/api/music/popular?limit=24")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MusicTrack[]) => setPopular(data || []))
      .catch(() => setPopular([]))
      .finally(() => setPopularLoading(false));
  }, []);

  // 검색
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

  const handleRoulette = async () => {
    setRouletteLoading(true);
    try {
      const r = await apiFetch("/api/music/roulette", { method: "POST" });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.track) setActive(data.track);
    } finally {
      setRouletteLoading(false);
    }
  };

  const showResults = debounced.trim().length > 0;
  const display = showResults ? results : popular;

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* 배경 글로우 */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-lime-300/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-sky-500/20 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-32 pt-6 sm:px-8">
        {/* 헤더 */}
        <header className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="뒤로"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-black italic tracking-tighter sm:text-3xl">
            POP&middot;MUSIC
          </h1>
          <span className="ml-auto hidden rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 sm:inline-block">
            Beta
          </span>
        </header>

        {/* 히어로 */}
        <section className="mt-6 sm:mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-lime-300/80">
            Music meets Popups
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            지금 듣는 노래에 어울리는 <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-lime-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent">
              팝업스토어
            </span>
            를 찾아드려요
          </h2>
          <p className="mt-3 max-w-xl text-sm text-white/60 sm:text-base">
            AI가 곡의 분위기를 분석해서, 그 무드에 가장 잘 맞는 팝업을 추천합니다.
          </p>
        </section>

        {/* 검색 */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="아티스트, 곡명으로 검색"
              className="h-12 w-full rounded-full border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-white/30 backdrop-blur transition focus:border-lime-300/50 focus:bg-white/10 focus:outline-none"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
            )}
          </div>

          <button
            onClick={handleRoulette}
            disabled={rouletteLoading}
            className="group flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-lime-300 to-emerald-300 px-5 text-sm font-black text-ink-900 shadow-lg shadow-lime-300/20 transition hover:scale-[1.02] disabled:opacity-60"
          >
            {rouletteLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Dice5 className="h-4 w-4 transition group-hover:rotate-12" />
            )}
            운명의 곡 룰렛
          </button>

          <button
            onClick={() => router.push("/music/passport")}
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
          >
            <TicketIcon className="h-4 w-4" />
            패스포트
          </button>
        </div>

        {/* 섹션 타이틀 */}
        <div className="mt-12 mb-5 flex items-center gap-2">
          {showResults ? (
            <>
              <Search className="h-4 w-4 text-lime-300" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white/80">
                Search &quot;{debounced}&quot;
              </h3>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
                {results.length}
              </span>
            </>
          ) : (
            <>
              <Flame className="h-4 w-4 text-orange-300" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white/80">
                지금 인기있는 곡
              </h3>
            </>
          )}
        </div>

        {/* 그리드 */}
        {(popularLoading || searching) && display.length === 0 ? (
          <SkeletonGrid />
        ) : display.length === 0 ? (
          <EmptyState searched={showResults} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-6">
            <AnimatePresence mode="popLayout">
              {display.map((t, i) => (
                <TrackCard
                  key={t.id}
                  track={t}
                  index={i}
                  onPlay={() => setActive(t)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* 가이드 */}
        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          <FeatureBlock
            icon={<Sparkles className="h-5 w-5" />}
            title="AI 무드 분석"
            desc="Groq AI가 곡의 분위기를 다섯 가지 키워드로 분해합니다."
          />
          <FeatureBlock
            icon={<Flame className="h-5 w-5" />}
            title="팝업 매칭"
            desc="무드와 팝업 설명이 겹치는 정도를 점수로 계산해 추천."
          />
          <FeatureBlock
            icon={<TicketIcon className="h-5 w-5" />}
            title="음악 패스포트"
            desc="들었던 곡과 매칭된 팝업이 나만의 기록으로 쌓입니다."
          />
        </section>
      </div>

      {/* 플레이어 */}
      <MusicPlayerModal
        track={active}
        playlist={display}
        onClose={() => setActive(null)}
        onChangeTrack={(t) => setActive(t)}
      />
    </div>
  );
}

/* -------------------- SubComponents -------------------- */

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
      exit={{ opacity: 0, y: -12 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      onClick={onPlay}
      className="group text-left"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 transition group-hover:ring-white/30">
        {track.artworkUrlHires || track.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.artworkUrlHires || track.artworkUrl}
            alt={track.trackName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full place-items-center text-3xl text-white/20">♪</div>
        )}

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 transition group-hover:opacity-100">
          <div className="flex w-full items-center justify-between p-3">
            {track.isOfficial && (
              <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-ink-900">
                Official
              </span>
            )}
            <span className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-lime-300 text-ink-900 shadow-xl transition group-hover:scale-110">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="truncate text-sm font-bold text-white">{track.trackName}</p>
        <p className="truncate text-xs text-white/50">{track.artistName}</p>
      </div>
    </motion.button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-square animate-pulse rounded-xl bg-white/5" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-20 text-center backdrop-blur">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
        {searched ? (
          <Search className="h-6 w-6 text-white/50" />
        ) : (
          <Flame className="h-6 w-6 text-white/50" />
        )}
      </div>
      <p className="text-sm font-bold text-white/70">
        {searched ? "검색 결과가 없어요" : "아직 인기곡 데이터가 부족해요"}
      </p>
      <p className="mt-1 text-xs text-white/40">
        {searched
          ? "다른 키워드로 시도해보세요"
          : "검색해서 좋아하는 곡을 재생해보세요"}
      </p>
    </div>
  );
}

function FeatureBlock({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300/15 text-lime-300">
        {icon}
      </div>
      <h4 className="mt-3 text-base font-black text-white">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-white/50">{desc}</p>
    </div>
  );
}
