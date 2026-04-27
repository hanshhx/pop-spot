import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스 병합 헬퍼.
 * 충돌하는 클래스(예: `p-2` + `p-4`)는 뒤쪽이 이김.
 *
 * @example
 *   cn("p-2 bg-red-500", isActive && "bg-blue-500")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 숫자를 한국식 K/M 표기로.
 *   1234 → "1.2K", 1_500_000 → "1.5M"
 */
export function formatCompactNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** D-day 계산. 만료된 경우 0 반환. */
export function getDaysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const diff = expiry.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
