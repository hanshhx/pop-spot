"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Ticket, Music2, MapPin, Sparkles } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { MusicTrack, UserMusicHistory } from "@/types/music";
import { useMusicPlayer } from "@/components/music/MusicPlayerProvider";

interface HistoryItem extends UserMusicHistory {
  // 백엔드가 entity 그대로 보내고 있어서 일단 raw 사용.
  // track / popup join 정보는 별도 fetch로 보강한다.
}

export default function MusicPassportPage() {
  const router = useRouter();
  const player = useMusicPlayer();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tracks, setTracks] = useState<Record<number, MusicTrack>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/music/history?limit=50")
      .then((r) => (r.ok ? r.json() : []))
      .then(async (data: HistoryItem[]) => {
        setHistory(data || []);
        // 트랙 메타 보강: history에 trackId만 있으니 popular 캐시에서 일단 매칭
        // (backend가 join 추가하기 전 임시)
        const popularRes = await apiFetch("/api/music/popular?limit=100").catch(
          () => null
        );
        if (popularRes?.ok) {
          const list: MusicTrack[] = await popularRes.json();
          const map: Record<number, MusicTrack> = {};
          list.forEach((t) => (map[t.id] = t));
          setTracks(map);
        }
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  // 통계
  const stats = useMemo(() => {
    const trackIds = new Set(history.map((h) => h.trackId));
    const popupIds = new Set(
      history.filter((h) => h.matchedPopupId).map((h) => h.matchedPopupId)
    );
    return {
      plays: history.length,
      uniqueTracks: trackIds.size,
      matchedPopups: popupIds.size,
    };
  }, [history]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* 배경 */}
      <div className="pointer-events-none absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-amber-300/15 blur-[140px]" />
      <div className="pointer-events-none absolute -right-32 top-40 h-[420px] w-[420px] rounded-full bg-rose-400/15 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-6 sm:px-8">
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
            MUSIC PASSPORT
          </h1>
        </header>

        {/* 패스포트 카드 */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 backdrop-blur sm:p-10"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-300 text-ink-900">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/50">
                Pop·Spot Music Passport
              </p>
              <p className="text-base font-black text-white">
                내가 들었던 음악으로 만든 팝업 기록
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-6">
            <StatCell label="총 재생" value={stats.plays} suffix="회" />
            <StatCell label="감상한 곡" value={stats.uniqueTracks} suffix="곡" />
            <StatCell label="매칭된 팝업" value={stats.matchedPopups} suffix="개" />
          </div>
        </motion.section>

        {/* 타임라인 */}
        <div className="mt-12 mb-5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white/80">
            최근 재생 기록
          </h3>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : history.length === 0 ? (
          <EmptyHistory />
        ) : (
          <ol className="space-y-2">
            {history.map((h, i) => {
              const t = tracks[h.trackId];
              return (
                <motion.li
                  key={h.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-3 backdrop-blur transition hover:bg-white/10"
                >
                  <button
                    onClick={() => t && player.play(t)}
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10"
                    disabled={!t}
                  >
                    {t?.artworkUrl || t?.artworkUrlHires ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.artworkUrl || t.artworkUrlHires}
                        alt={t.trackName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-white/30">
                        <Music2 className="h-5 w-5" />
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {t?.trackName ?? `Track #${h.trackId}`}
                    </p>
                    <p className="truncate text-xs text-white/50">
                      {t?.artistName ?? "—"} · {fmtDate(h.playedAt)}
                    </p>
                  </div>

                  {h.matchedPopupId && (
                    <Link
                      href={`/popup/${h.matchedPopupId}`}
                      className="hidden items-center gap-1 rounded-full bg-amber-300/20 px-2.5 py-1 text-[11px] font-bold text-amber-200 transition hover:bg-amber-300/30 sm:inline-flex"
                    >
                      <MapPin className="h-3 w-3" />
                      매칭 팝업
                    </Link>
                  )}
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>

    </div>
  );
}

/* -------------------- SubComponents -------------------- */

function StatCell({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-center backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </p>
      <p className="mt-1 font-mono text-3xl font-black text-white">
        {value}
        <span className="ml-1 text-sm font-bold text-white/50">{suffix}</span>
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl bg-white/5 p-3"
        >
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-16 text-center backdrop-blur">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
        <Music2 className="h-6 w-6 text-white/50" />
      </div>
      <p className="text-sm font-bold text-white/70">
        아직 재생한 곡이 없어요
      </p>
      <p className="mt-1 text-xs text-white/40">
        음악 페이지에서 곡을 재생하면 패스포트에 기록됩니다.
      </p>
      <Link
        href="/music"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-ink-900 transition hover:scale-105"
      >
        <Music2 className="h-3.5 w-3.5" />
        음악 둘러보기
      </Link>
    </div>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
