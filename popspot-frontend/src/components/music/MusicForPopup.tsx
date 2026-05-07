"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Music2, Play, Sparkles } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { MusicTrack } from "@/types/music";
import MusicPlayerModal from "./MusicPlayerModal";

interface TrackMatch {
  track: MusicTrack;
  moodTags: string[];
  score: number;
}

interface Props {
  popupId: number;
  /** 외부에서 모달 상태를 끌어쓰고 싶을 때 (선택). 미지정 시 내부 상태 사용 */
  onPlayTrack?: (t: MusicTrack) => void;
}

/**
 * 팝업 상세페이지에 끼워 쓰는 "이 팝업에 어울리는 곡" 위젯.
 * 백엔드 GET /api/music/by-popup/{id} 호출 → 곡 카드 목록 + 인라인 플레이어.
 */
export default function MusicForPopup({ popupId, onPlayTrack }: Props) {
  const [matches, setMatches] = useState<TrackMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<MusicTrack | null>(null);

  useEffect(() => {
    if (!popupId) return;
    setLoading(true);
    apiFetch(`/api/music/by-popup/${popupId}?limit=6`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TrackMatch[]) => setMatches(data || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [popupId]);

  if (loading) {
    return (
      <div className="my-6 rounded-2xl border border-[var(--color-border)] bg-cream-200 dark:bg-ink-800 p-5">
        <div className="mb-3 h-4 w-40 animate-pulse rounded bg-foreground/10" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square animate-pulse rounded-lg bg-foreground/10" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-foreground/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <>
      <section className="my-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-cream-200 via-cream-200 to-cream-300 dark:from-ink-800 dark:via-ink-800 dark:to-ink-900 p-5">
        <header className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-lime-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
            이 팝업과 어울리는 곡
          </h3>
          <span className="ml-auto rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            AI 매칭
          </span>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {matches.map((m, i) => (
            <motion.button
              key={m.track.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => (onPlayTrack ? onPlayTrack(m.track) : setActive(m.track))}
              className="group text-left"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-foreground/5 ring-1 ring-[var(--color-border)] transition group-hover:ring-foreground/30">
                {m.track.artworkUrlHires || m.track.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.track.artworkUrlHires || m.track.artworkUrl}
                    alt={m.track.trackName}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-2xl text-muted-foreground">
                    <Music2 className="h-6 w-6" />
                  </div>
                )}

                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent opacity-0 transition group-hover:opacity-100">
                  <div className="flex w-full items-center justify-between p-2">
                    <span className="rounded-full bg-lime-300 px-1.5 py-0.5 text-[9px] font-black text-ink-900">
                      🎯 {m.score}%
                    </span>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-300 text-ink-900 shadow-lg transition group-hover:scale-110">
                      <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-2 truncate text-sm font-bold text-foreground">
                {m.track.trackName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.track.artistName}
              </p>
            </motion.button>
          ))}
        </div>
      </section>

      {/* 외부에서 onPlayTrack 안 줬을 때만 자체 모달 */}
      {!onPlayTrack && (
        <MusicPlayerModal
          track={active}
          onClose={() => setActive(null)}
          onChangeTrack={(t) => setActive(t)}
        />
      )}
    </>
  );
}
