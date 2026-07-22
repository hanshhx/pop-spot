"use client";

import { useMemo, useState } from "react";
import { Flame, Ticket, Users, ArrowRight, Store } from "lucide-react";
import type { PopupStore } from "@/types/popup";
import { popupCoverUrl } from "@/lib/popupCover";

/**
 * 홈 하단 발견 존 — 1a안 (히어로 + 서브 타일).
 *
 * <p>6칸 벤토를 3칸으로: 실시간 랭킹을 큰 히어로로, 나의 기록(여권)·같이 갈 사람(동행)을 사이드 타일로.
 * 필터 칩(이번 주·마감임박·혼잡)은 실제로 랭킹을 필터한다. 서브 타일은 <b>유저별로 다른 값을 하드코딩하지 않고</b>
 * 기능 설명 + 일반 일러스트만 둔다(실제 카운트가 필요하면 로그인 데이터를 별도로 배선).
 */

function ddayNum(endDate?: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

function statusTone(status?: string): string {
  if (status === "혼잡") return "text-hot-500 dark:text-hot-400";
  if (status === "여유") return "text-lime-600 dark:text-lime-400";
  return "text-amber-500 dark:text-amber-300";
}

type ChipKey = "전체" | "이번 주" | "마감임박" | "혼잡";

interface Props {
  popups: PopupStore[];
  total: number;
  onOpenRanking: () => void;
  onNavigate: (tab: string) => void;
}

export default function HomeBento1a({ popups, total, onOpenRanking, onNavigate }: Props) {
  const [chip, setChip] = useState<ChipKey>("전체");

  const filtered = useMemo(() => {
    if (chip === "마감임박")
      return popups.filter((p) => {
        const d = ddayNum(p.endDate);
        return d !== null && d >= 0 && d <= 3;
      });
    if (chip === "이번 주")
      return popups.filter((p) => {
        const d = ddayNum(p.endDate);
        return d !== null && d >= 0 && d <= 7;
      });
    if (chip === "혼잡") return popups.filter((p) => p.status === "혼잡");
    return popups;
  }, [popups, chip]);

  const top = filtered.slice(0, 4);

  const chips: { key: ChipKey; label: string }[] = [
    { key: "전체", label: `전체 ${total || popups.length}` },
    { key: "이번 주", label: "이번 주" },
    { key: "마감임박", label: "마감임박" },
    { key: "혼잡", label: "혼잡" },
  ];

  return (
    <section
      aria-label="발견"
      className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2"
    >
      {/* 실시간 랭킹 히어로 — 라이트=흰 카드/진한 글씨, 다크=딥카드(기존 유지) */}
      <div className="flex flex-col rounded-[2rem] border border-black/[0.06] bg-white p-5 text-ink-900 shadow-pop md:p-6 lg:col-span-2 lg:row-span-2 dark:border-transparent dark:bg-ink-900 dark:text-cream-200">
        <div className="mb-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              aria-pressed={chip === c.key}
              className={`rounded-pill px-3 py-1 text-[11px] font-bold transition ${
                chip === c.key
                  ? "bg-lime-300 text-ink-900"
                  : "border border-black/15 text-ink-500 hover:text-ink-900 dark:border-ink-700 dark:text-cream-200/60 dark:hover:text-cream-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <header className="mb-3 flex items-center gap-2">
          <Flame size={18} className="animate-pulse text-hot-400" />
          <h3 className="text-lg font-black">실시간 랭킹</h3>
        </header>

        <div className="flex-1 space-y-1">
          {popups.length === 0 ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 p-2">
                <div className="h-4 w-4 rounded bg-black/10 dark:bg-white/10" />
                <div className="h-11 w-11 rounded-xl bg-black/10 dark:bg-white/10" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 rounded bg-black/10 dark:bg-white/10" />
                  <div className="h-2 w-1/3 rounded bg-black/10 dark:bg-white/10" />
                </div>
              </div>
            ))
          ) : top.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400 dark:text-cream-200/40">
              이 조건에 맞는 팝업이 없어요.
            </p>
          ) : (
            top.map((p, i) => {
              const coverUrl = popupCoverUrl(p, 200);
              return (
                <button
                key={p.id}
                type="button"
                onClick={onOpenRanking}
                className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span
                  className={`w-4 shrink-0 text-center text-sm font-black ${i === 0 ? "text-lime-600 dark:text-lime-300" : "text-ink-400 dark:text-cream-200/40"}`}
                >
                  {i + 1}
                </span>
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-lime-200 to-emerald-300 dark:from-lime-900 dark:to-emerald-950">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store size={18} className="text-ink-700/55 dark:text-lime-200/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-bold">{p.name}</strong>
                  <span className="block truncate text-[11px] text-ink-500 dark:text-cream-200/45">
                    {(p.location || "").split(" ").slice(0, 2).join(" ")} ·{" "}
                    <span className={statusTone(p.status)}>{p.status || "영업중"}</span>
                  </span>
                </div>
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={onOpenRanking}
          className="mt-3 w-full rounded-xl bg-lime-400/15 py-2.5 text-center text-xs font-bold text-lime-700 transition hover:bg-lime-400/25 dark:bg-lime-300/15 dark:text-lime-300 dark:hover:bg-lime-300/25"
        >
          전체 랭킹 보기 →
        </button>
      </div>

      {/* 나의 기록 (여권) — 유저별 값 없이 기능 설명만 */}
      <button
        type="button"
        onClick={() => onNavigate("PASSPORT")}
        className="group relative overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white p-5 text-left text-ink-900 shadow-pop transition hover:scale-[1.02] md:p-6 lg:col-span-1 dark:border-transparent dark:bg-ink-900 dark:text-cream-200"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/25 blur-2xl"
        />
        <Ticket
          size={120}
          className="pointer-events-none absolute -bottom-6 -right-4 rotate-[-12deg] text-amber-300/10"
          aria-hidden
        />
        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 text-ink-900">
            <Ticket size={18} />
          </span>
          <div>
            <h3 className="text-base font-black">나의 기록</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-cream-200/55">
              방문한 팝업을 도장으로 기록하고 스탬프를 모아요.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-300">
              여권 열기 <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </button>

      {/* 같이 갈 사람 (동행) — 유저별 값 없이 기능 설명만 */}
      <button
        type="button"
        onClick={() => onNavigate("MATE")}
        className="group relative overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white p-5 text-left text-ink-900 shadow-pop transition hover:scale-[1.02] md:p-6 lg:col-span-1 dark:border-transparent dark:bg-ink-900 dark:text-cream-200"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-400/25 blur-2xl"
        />
        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400 text-ink-900">
            <Users size={18} />
          </span>
          <div>
            <div className="mb-2 flex -space-x-2" aria-hidden>
              {["bg-lime-300", "bg-hot-400", "bg-sky-400"].map((c, i) => (
                <span key={i} className={`h-7 w-7 rounded-full ring-2 ring-white dark:ring-ink-900 ${c}`} />
              ))}
            </div>
            <h3 className="text-base font-black">같이 갈 사람</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-cream-200/55">
              관심사 맞는 동행을 찾아 함께 다녀와요.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-300">
              동행 찾기 <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </button>
    </section>
  );
}
