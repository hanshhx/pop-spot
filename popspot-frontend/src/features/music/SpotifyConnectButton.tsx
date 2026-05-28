"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Disc3, Loader2, Music2, X } from "lucide-react";

import { notify } from "@/lib/notify";
import { useSpotifyAuth } from "./useSpotifyAuth";

/**
 * v2.21-S11 — 음악 탭 헤더에 박을 Spotify 연결 칩.
 *
 * <p>3가지 상태:
 *
 * <ul>
 *   <li>미연결 — 녹색 "Spotify 연결" 버튼 (클릭 시 Spotify 로그인 페이지로)
 *   <li>연결 + Premium — 라임 "Premium 연결됨" 배지 + X 로 끊기
 *   <li>연결 + Free — 회색 "연결됨 (Free)" 배지 + X 로 끊기 + 안내 텍스트
 * </ul>
 *
 * <p>콜백 후 URL 에 ?spotify=connected/error/denied 가 붙어 돌아오면 즉시 토스트.
 *
 * <p>Spotify 어트리뷰션 (Branding Guidelines) — 버튼/배지에 Spotify 로고 (Disc3 아이콘 +
 * "Spotify" 텍스트) 명시. v2.21-S14 에서 공식 SVG 로 교체 예정.
 */

export function SpotifyConnectButton() {
  const { connected, isPremium, loading, startLogin, disconnect, refresh } = useSpotifyAuth();
  const searchParams = useSearchParams();

  // 콜백 후 토스트 + 상태 갱신 + URL 정리
  useEffect(() => {
    const status = searchParams?.get("spotify");
    if (!status) return;

    if (status === "connected") {
      notify({
        icon: "success",
        title: "Spotify 연결 완료",
        text: "프리미엄이면 풀트랙, 무료면 30초 미리듣기로 재생됩니다.",
        timer: 3000,
      });
      void refresh();
    } else if (status === "denied") {
      notify({
        icon: "info",
        title: "Spotify 연결을 취소했어요",
        text: "언제든 다시 연결할 수 있습니다.",
        timer: 2500,
      });
    } else if (status === "error") {
      notify({
        icon: "error",
        title: "Spotify 연결 실패",
        text: "잠시 후 다시 시도해주세요.",
        timer: 3000,
      });
    }

    // URL 에서 ?spotify= 쿼리 제거 (history 더럽히지 않음)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("spotify");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, refresh]);

  async function handleConnect() {
    try {
      await startLogin();
    } catch (e) {
      notify({
        icon: "error",
        title: "연결 시작 실패",
        text: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
      });
    }
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        "Spotify 연결을 해제할까요? 저장된 토큰이 즉시 삭제됩니다. (다시 연결 가능)",
      )
    ) {
      return;
    }
    try {
      await disconnect();
      notify({
        icon: "success",
        title: "Spotify 연결 해제",
        timer: 2000,
      });
    } catch {
      notify({
        icon: "error",
        title: "해제 실패",
        text: "잠시 후 다시 시도해주세요.",
      });
    }
  }

  if (loading) {
    return (
      <span
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill border border-gray-200 dark:border-white/10 text-xs text-muted-foreground"
        aria-label="Spotify 연결 상태 확인 중"
      >
        <Loader2 size={12} className="animate-spin" />
        확인 중…
      </span>
    );
  }

  if (!connected) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        aria-label="Spotify 계정 연결"
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-xs font-bold transition-all bg-[#1DB954] text-white hover:bg-[#1ed760] shadow-sm hover:shadow-md"
      >
        <Disc3 size={14} className="shrink-0" />
        <span>Spotify 연결</span>
      </button>
    );
  }

  // 연결됨 — Premium / Free 구분
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-xs font-bold ${
          isPremium
            ? "bg-lime-300 text-ink-900 border border-lime-400"
            : "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-white/10 dark:text-white dark:border-white/15"
        }`}
        title={
          isPremium
            ? "Premium 계정 — 풀트랙 320kbps 재생 가능"
            : "Free 계정 — 30초 미리듣기로 재생"
        }
      >
        <Music2 size={12} className="shrink-0" />
        <Check size={12} className="shrink-0" />
        <span>{isPremium ? "Spotify Premium" : "Spotify Free"}</span>
      </span>
      <button
        type="button"
        onClick={handleDisconnect}
        aria-label="Spotify 연결 해제"
        title="Spotify 연결 해제"
        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}
