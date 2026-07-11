"use client";

import { useState } from "react";
import { Heart, MapPin, Shirt, Coffee, Palette, Star, Sparkles, Cpu, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { popupCoverUrl } from "@/lib/popupCover";
import type { PopupStore } from "@/types/popup";

/**
 * 팝업 사진 카드 — 디자인 진단서 P0. 사진 + D-day + 지역 + 카테고리 + ♥ 를 한 장에.
 *
 * <p>기존 홈은 텍스트 랭킹 리스트라 "팝업을 눈으로 훑어보는" 코어 경험이 약했다. 크롤링 imageUrl 은 임의 호스트라
 * next/image 대신 순수 <img> 로 렌더(도메인 화이트리스트 불필요). 사진 없으면 지도핀 플레이스홀더.
 */

function ddayLabel(endDate?: string): string | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return "종료";
  if (diff === 0) return "오늘 마감";
  return `D-${diff}`;
}

const CATEGORY_KO: Record<string, string> = {
  FASHION: "패션",
  FOOD: "푸드",
  CULTURE: "문화",
  CHARACTER: "캐릭터",
  BEAUTY: "뷰티",
  TECH: "테크",
  ETC: "기타",
};

/**
 * 사진이 없을 때(자동수집 팝업 대부분)의 플레이스홀더 스타일. 카테고리별 브랜드 그라디언트 + 아이콘 —
 * 잘못된 사진을 붙이는 대신 "의도된 디자인"으로 보이게. 색은 소스에 문자열 리터럴로 박아 Tailwind JIT 가 인식.
 */
const CATEGORY_STYLE: Record<string, { grad: string; Icon: typeof MapPin }> = {
  FASHION: { grad: "from-pink-200 to-rose-300", Icon: Shirt },
  FOOD: { grad: "from-amber-200 to-orange-300", Icon: Coffee },
  CULTURE: { grad: "from-violet-200 to-indigo-300", Icon: Palette },
  CHARACTER: { grad: "from-lime-200 to-emerald-300", Icon: Star },
  BEAUTY: { grad: "from-fuchsia-200 to-pink-300", Icon: Sparkles },
  TECH: { grad: "from-sky-200 to-cyan-300", Icon: Cpu },
  ETC: { grad: "from-gray-200 to-gray-300", Icon: Store },
};

export interface PopupCardProps {
  popup: PopupStore;
  onClick?: () => void;
  onWish?: () => void;
  wished?: boolean;
  className?: string;
}

export function PopupCard({ popup, onClick, onWish, wished, className }: PopupCardProps) {
  const [imgError, setImgError] = useState(false);
  const dday = ddayLabel(popup.endDate);
  const cat = popup.category
    ? CATEGORY_KO[popup.category.toUpperCase()] ?? popup.category
    : null;
  const region = (popup.location || "").split(" ").slice(0, 2).join(" ") || "서울";
  const catStyle = CATEGORY_STYLE[popup.category?.toUpperCase() ?? "ETC"] ?? CATEGORY_STYLE.ETC;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "group relative flex w-[220px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 dark:border-white/10 dark:bg-white/[0.04]",
        className,
      )}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100 dark:bg-white/5">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={popupCoverUrl(popup)}
            alt={popup.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${catStyle.grad}`}>
            <catStyle.Icon size={40} strokeWidth={1.5} className="text-white/60" />
          </div>
        )}

        {dday && (
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              dday === "종료" ? "bg-gray-800/80 text-white" : "bg-lime-300 text-ink-900"
            }`}
          >
            {dday}
          </span>
        )}

        {onWish && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWish();
            }}
            aria-label="위시리스트에 담기"
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-hot-400 backdrop-blur transition hover:bg-white dark:bg-black/50"
          >
            <Heart size={15} fill={wished ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{popup.name}</h3>
        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/50">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{region}</span>
        </div>
        {cat && (
          <span className="mt-0.5 inline-flex w-fit rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/10 dark:text-white/60">
            {cat}
          </span>
        )}
      </div>
    </div>
  );
}

export default PopupCard;
