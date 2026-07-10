"use client";

import { Flame, Ticket, Users } from "lucide-react";
import type { PopupStore } from "@/types/popup";

/**
 * 홈 하단 발견 존 — 1a안 (히어로 + 서브 타일).
 *
 * <p>6칸 벤토(랭킹·캘린더·혼잡도·음악·여권·동행)를 3칸으로 정리: 실시간 랭킹을 큰 히어로로, 나의 기록(여권)·같이 갈
 * 사람(동행)을 사이드 타일로. 캘린더·혼잡도는 지도 위 필터 칩으로, 음악은 검색 옆으로 이동(여기선 제외).
 */

const FILTER_CHIPS = ["이번 주", "마감임박", "혼잡 실시간"];

function statusTone(status?: string): string {
  if (status === "혼잡") return "text-hot-400";
  if (status === "여유") return "text-lime-400";
  return "text-amber-300";
}

interface Props {
  popups: PopupStore[];
  total: number;
  onOpenRanking: () => void;
  onNavigate: (tab: string) => void;
}

export default function HomeBento1a({ popups, total, onOpenRanking, onNavigate }: Props) {
  const top = popups.slice(0, 4);

  return (
    <section
      aria-label="발견"
      className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2"
    >
      {/* 실시간 랭킹 히어로 */}
      <div className="flex flex-col rounded-[2rem] bg-ink-900 p-5 text-cream-200 shadow-pop md:p-6 lg:col-span-2 lg:row-span-2">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-pill bg-lime-300 px-3 py-1 text-[11px] font-bold text-ink-900">
            전체 {total || 0}
          </span>
          {FILTER_CHIPS.map((c) => (
            <span
              key={c}
              className="rounded-pill border border-ink-700 px-3 py-1 text-[11px] font-semibold text-cream-200/60"
            >
              {c}
            </span>
          ))}
        </div>

        <header className="mb-3 flex items-center gap-2">
          <Flame size={18} className="animate-pulse text-hot-400" />
          <h3 className="text-lg font-black">실시간 랭킹</h3>
        </header>

        <div className="flex-1 space-y-1">
          {top.length > 0
            ? top.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={onOpenRanking}
                  className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/5"
                >
                  <span
                    className={`w-4 shrink-0 text-center text-sm font-black ${i === 0 ? "text-lime-300" : "text-cream-200/40"}`}
                  >
                    {i + 1}
                  </span>
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-bold">{p.name}</strong>
                    <span className="block truncate text-[11px] text-cream-200/45">
                      {(p.location || "").split(" ").slice(0, 2).join(" ")} ·{" "}
                      <span className={statusTone(p.status)}>{p.status || "영업중"}</span>
                    </span>
                  </div>
                </button>
              ))
            : [...Array(4)].map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 p-2">
                  <div className="h-4 w-4 rounded bg-white/10" />
                  <div className="h-11 w-11 rounded-xl bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 rounded bg-white/10" />
                    <div className="h-2 w-1/3 rounded bg-white/10" />
                  </div>
                </div>
              ))}
        </div>

        <button
          type="button"
          onClick={onOpenRanking}
          className="mt-3 w-full rounded-xl bg-lime-300/15 py-2.5 text-center text-xs font-bold text-lime-300 transition hover:bg-lime-300/25"
        >
          전체 랭킹 보기 →
        </button>
      </div>

      {/* 나의 기록 (여권) */}
      <button
        type="button"
        onClick={() => onNavigate("PASSPORT")}
        className="group relative overflow-hidden rounded-[2rem] bg-ink-900 p-5 text-left text-cream-200 shadow-pop transition hover:scale-[1.02] md:p-6 lg:col-span-1"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/25 blur-2xl"
        />
        <div className="relative z-10 flex h-full flex-col justify-between gap-4">
          <div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 text-ink-900">
              <Ticket size={18} />
            </span>
            <h3 className="mt-3 text-base font-black">나의 기록</h3>
            <p className="text-xs text-cream-200/55">스탬프 5개 · Lv.3</p>
          </div>
          <div className="flex gap-1.5">
            {[1, 1, 1, 0].map((s, i) => (
              <span
                key={i}
                className={`h-6 w-6 rounded-full border-2 border-dashed ${s ? "border-amber-300/60 bg-amber-300/15" : "border-ink-700"}`}
              />
            ))}
          </div>
        </div>
      </button>

      {/* 같이 갈 사람 (동행) */}
      <button
        type="button"
        onClick={() => onNavigate("MATE")}
        className="group relative overflow-hidden rounded-[2rem] bg-ink-900 p-5 text-left text-cream-200 shadow-pop transition hover:scale-[1.02] md:p-6 lg:col-span-1"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-400/25 blur-2xl"
        />
        <div className="relative z-10 flex h-full flex-col justify-between gap-4">
          <div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400 text-ink-900">
              <Users size={18} />
            </span>
            <h3 className="mt-3 text-base font-black">같이 갈 사람</h3>
            <p className="text-xs text-cream-200/55">매칭중 · 2/4</p>
          </div>
          <div className="flex -space-x-2">
            {["bg-lime-300", "bg-hot-400", "bg-sky-400"].map((c, i) => (
              <span key={i} className={`h-7 w-7 rounded-full ring-2 ring-ink-900 ${c}`} />
            ))}
          </div>
        </div>
      </button>
    </section>
  );
}
