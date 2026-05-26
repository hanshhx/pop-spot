"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  /** sm: 16px / md: 24px / lg: 40px */
  size?: "sm" | "md" | "lg";
  /** 보조 설명 텍스트. 없으면 스피너만. */
  label?: string;
  /** 카드 내부에 inline 으로 둘지 (false), 화면 중앙 전체에 띄울지 (true). */
  fullscreen?: boolean;
  className?: string;
}

const SIZE_CLASS = {
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
} as const;

/**
 * v2.18 — 로딩 표시 공용 컴포넌트.
 *
 * <p>이전엔 인라인 spinner / Loader2 직접 호출 / spinner 클래스 차이 등 혼재. 본 컴포넌트로
 * 통일해 사이즈 / 라벨 / fullscreen 모드를 한 곳에서 관리.
 */
export function LoadingSpinner({
  size = "md",
  label,
  fullscreen = false,
  className,
}: LoadingSpinnerProps) {
  if (fullscreen) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col items-center justify-center",
          "bg-background/80 backdrop-blur-sm gap-3",
          className,
        )}
      >
        <Loader2 className={cn(SIZE_CLASS.lg, "animate-spin text-lime-500")} />
        {label && <p className="text-sm text-muted-foreground">{label}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-2 text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn(SIZE_CLASS[size], "animate-spin")} />
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}
