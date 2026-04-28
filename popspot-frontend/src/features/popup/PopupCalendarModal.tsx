"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PopupStore } from "@/types/popup";

interface PopupCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popups: PopupStore[];
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * 월별 팝업 일정 캘린더 모달.
 * 날짜 클릭 시 해당 날짜에 진행 중인 팝업 목록 노출.
 */
export function PopupCalendarModal({
  open,
  onOpenChange,
  popups,
}: PopupCalendarModalProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(
    new Date().getDate()
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo<(number | null)[]>(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [year, month]);

  const getPopupsForDate = (day: number | null): PopupStore[] => {
    if (!day) return [];
    const targetDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    return popups.filter((p) => {
      if (!p.startDate) return false;
      const start = p.startDate;
      const end = p.endDate || p.startDate;
      return targetDate >= start && targetDate <= end;
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  const selectedPopups = getPopupsForDate(selectedDay);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5 text-lime-500" aria-hidden />
            팝업 캘린더
          </DialogTitle>
          <DialogDescription>
            원하는 날짜를 눌러 일정을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          <nav className="flex justify-between items-center mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="이전 달"
              className="size-9 inline-flex items-center justify-center rounded-pill hover:bg-foreground/5 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <span className="font-bold text-lg text-foreground tabular-nums">
              {year}년 {month + 1}월
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="다음 달"
              className="size-9 inline-flex items-center justify-center rounded-pill hover:bg-foreground/5 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </nav>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "text-xs font-bold py-1",
                  i === 0
                    ? "text-hot-400"
                    : i === 6
                    ? "text-lime-500"
                    : "text-muted-foreground"
                )}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1" role="grid">
            {days.map((day, idx) => {
              const dailyPopups = getPopupsForDate(day);
              const hasPopups = dailyPopups.length > 0;
              const isSelected = day === selectedDay;
              const dayOfWeek = idx % 7;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => day && setSelectedDay(day)}
                  disabled={!day}
                  aria-label={day ? `${month + 1}월 ${day}일` : undefined}
                  aria-pressed={isSelected}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center rounded-md transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !day && "invisible cursor-default",
                    day && !isSelected && "bg-cream-300 dark:bg-ink-800 hover:bg-cream-400 dark:hover:bg-ink-700",
                    isSelected && "bg-ink-900 dark:bg-cream-200 text-cream-200 dark:text-ink-900 shadow-md"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-bold",
                      !isSelected &&
                        (dayOfWeek === 0
                          ? "text-hot-400"
                          : dayOfWeek === 6
                          ? "text-lime-500"
                          : "text-foreground")
                    )}
                  >
                    {day}
                  </span>
                  {hasPopups && day && (
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full mt-0.5",
                        isSelected ? "bg-cream-200 dark:bg-ink-900" : "bg-lime-500"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 border-t border-[var(--color-border)] pt-4 max-h-[280px] overflow-y-auto custom-scrollbar">
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
              <span
                aria-hidden
                className="size-2 bg-lime-500 rounded-full animate-pulse"
              />
              {month + 1}월 {selectedDay}일 진행 팝업 ({selectedPopups.length})
            </h4>

            {selectedPopups.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-[var(--color-border-strong)] rounded-md">
                이 날은 팝업 일정이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedPopups.map((popup) => (
                  <Link
                    href={`/popup/${popup.id}`}
                    key={popup.id}
                    onClick={() => onOpenChange(false)}
                  >
                    <article className="p-3 bg-cream-300 dark:bg-ink-800 rounded-md border border-[var(--color-border)] flex justify-between items-center hover:border-lime-300/60 transition-colors group cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <h5 className="font-semibold text-sm text-foreground group-hover:text-lime-500 transition-colors truncate flex items-center gap-1.5">
                          {popup.name}
                          {/* [V4] 자동수집 정보임을 한눈에 알리는 뱃지 — 정확성 면책의 가시성 확보 */}
                          {popup.sourceType === "CRAWLED" && (
                            <span
                              title="AI 자동수집 정보 — 상세페이지에서 출처 확인"
                              className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-pill"
                            >
                              <Sparkles className="size-2.5" aria-hidden />
                              AI
                            </span>
                          )}
                        </h5>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {popup.location}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 bg-surface border border-[var(--color-border)] text-foreground rounded-pill shrink-0 ml-3 group-hover:bg-lime-300 group-hover:text-ink-900 group-hover:border-lime-300 transition-colors">
                        상세
                      </span>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
