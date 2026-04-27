"use client";

import Link from "next/link";
import { Users, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { PopupStore } from "@/types/popup";

interface AllTrendingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popups: PopupStore[];
}

/**
 * 전체 트렌딩 팝업 목록 모달.
 * 메인 페이지 랭킹 카드 우상단의 + 버튼으로 열림.
 */
export function AllTrendingModal({
  open,
  onOpenChange,
  popups,
}: AllTrendingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            <span className="font-display-en text-2xl md:text-3xl font-extrabold tracking-tighter">
              ALL TRENDING
            </span>
            <span className="text-lime-300 text-3xl">.</span>
          </DialogTitle>
          <DialogDescription>
            서울에서 가장 핫한 팝업스토어 실시간 랭킹
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto custom-scrollbar -mx-1 px-1">
          {popups.length === 0 ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse w-full p-5 rounded-md bg-cream-300 dark:bg-ink-800 flex items-center gap-4"
                >
                  <div className="size-10 bg-cream-400 dark:bg-ink-700 rounded-pill" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/2 bg-cream-400 dark:bg-ink-700 rounded" />
                    <div className="h-3 w-1/4 bg-cream-400 dark:bg-ink-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {popups.map((popup, idx) => (
                <Link
                  href={`/popup/${popup.id}`}
                  key={popup.id}
                  onClick={() => onOpenChange(false)}
                >
                  <article className="flex items-center justify-between p-4 rounded-md transition-colors group bg-surface border border-[var(--color-border)] hover:border-lime-300/60 hover:bg-cream-300 dark:hover:bg-ink-800 cursor-pointer">
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className={`font-display-en font-extrabold text-2xl tabular-nums shrink-0 w-8 ${
                          idx < 3 ? "text-lime-500" : "text-muted-foreground"
                        }`}
                      >
                        {(idx + 1).toString().padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-sm md:text-base block mb-0.5 truncate text-foreground group-hover:text-lime-500 transition-colors">
                          {popup.name}
                        </span>
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <MapPin size={12} aria-hidden /> {popup.location}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 pl-3 shrink-0">
                      <span className="text-[10px] inline-flex items-center gap-1 text-muted-foreground">
                        <Users size={10} aria-hidden /> {popup.viewCount || 0}
                      </span>
                      <Badge
                        tone={popup.status === "혼잡" ? "hot" : "lime"}
                        size="sm"
                      >
                        {popup.status || "영업중"}
                      </Badge>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
