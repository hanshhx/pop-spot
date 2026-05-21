"use client";

import { ReactNode } from "react";

/**
 * 어드민 대시보드의 단일 메트릭 카드.
 *
 * - 큰 숫자 1 개를 가운데 강조하고 좌측 라벨 + 우측 아이콘 배치.
 * - 보조 정보(예: "최대 20" / "오늘") 는 sub prop 으로.
 * - 위험 단계가 있으면 tone="warning" / "danger" — 라이트/다크 색 자동.
 */
export type MetricTone = "neutral" | "ok" | "warning" | "danger";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: string;
  icon?: ReactNode;
  tone?: MetricTone;
}

const TONE_CLASS: Record<MetricTone, string> = {
  neutral: "text-foreground",
  ok: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export function MetricCard({
  label,
  value,
  unit,
  sub,
  icon,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-bold mb-1">{label}</p>
        <h3 className={`text-3xl font-black ${TONE_CLASS[tone]} truncate`}>
          {value}
          {unit && (
            <span className="text-sm text-gray-400 font-normal ml-1">{unit}</span>
          )}
        </h3>
        {sub && <p className="text-[11px] text-gray-400 mt-1 truncate">{sub}</p>}
      </div>
      {icon && (
        <div className="p-3 bg-lime-300/10 dark:bg-ink-800 rounded-xl text-lime-500 shrink-0">
          {icon}
        </div>
      )}
    </div>
  );
}
