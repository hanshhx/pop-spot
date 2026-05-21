"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

/**
 * 어드민 대시보드 메트릭 폴링 훅.
 *
 * - {@code /api/admin/metrics/dashboard} 를 3 초마다 호출.
 * - 시계열 라인 차트용 점 한 개를 만들어 최근 N 개만 보관 (FIFO).
 * - online/offline 판정 (HTTP 실패 시 offline).
 *
 * @param toLinePoint 응답을 받아 차트용 점 1 개로 변환하는 함수
 * @param intervalMs 폴링 주기 (기본 3000ms)
 * @param bufferSize 차트 버퍼 크기 (기본 15)
 * @param enabled 폴링 활성 여부 (기본 true). v2.13.3 — 일반 유저가 admin URL 진입 시
 *     ADMIN role 검증 전까지 false 로 두어 403 도배를 차단
 */
export interface DashboardSnapshot {
  jvm?: Record<string, number>;
  http?: Record<string, number>;
  db?: Record<string, number>;
  crawler?: Record<string, number>;
  timestamp?: number;
}

interface UseDashboardMetricsResult<P> {
  snapshot: DashboardSnapshot | null;
  series: P[];
  status: "online" | "offline";
}

export function useDashboardMetrics<P>(
  toLinePoint: (s: DashboardSnapshot, now: Date) => P,
  intervalMs = 3000,
  bufferSize = 15,
  enabled = true,
): UseDashboardMetricsResult<P> {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [series, setSeries] = useState<P[]>([]);
  const [status, setStatus] = useState<"online" | "offline">("online");
  const toLinePointRef = useRef(toLinePoint);
  toLinePointRef.current = toLinePoint;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await apiFetch("/api/admin/metrics/dashboard");
        if (!res.ok) {
          if (!cancelled) setStatus("offline");
          return;
        }
        const data: DashboardSnapshot = await res.json();
        if (cancelled) return;
        setSnapshot(data);
        setStatus("online");
        const point = toLinePointRef.current(data, new Date());
        setSeries((prev) => [...prev, point].slice(-bufferSize));
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs, bufferSize, enabled]);

  return { snapshot, series, status };
}
