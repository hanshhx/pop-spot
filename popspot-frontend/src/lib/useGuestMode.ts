"use client";

import { useEffect, useState } from "react";
import {
  ensureGuestFirstVisit,
  getRemainingGuestDays,
  isGuestExpired,
  clearGuestMode,
} from "./guestMode";

/**
 * 게스트 모드 상태를 컴포넌트에서 쉽게 쓰기 위한 훅.
 *
 * <p>SSR 단계에선 hydration mismatch 회피용으로 모든 값이 기본값. mount 이후 실제 값으로 갱신.
 *
 * @param isLoggedIn 사용자 로그인 여부 — 로그인 시엔 게스트 추적을 시작하지 않는다.
 */
export function useGuestMode(isLoggedIn: boolean) {
  const [mounted, setMounted] = useState(false);
  const [remainingDays, setRemainingDays] = useState(7);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isLoggedIn) {
      // 로그인 사용자는 게스트 추적 불필요. 잔재가 있으면 정리.
      clearGuestMode();
      return;
    }
    const firstVisit = ensureGuestFirstVisit();
    setRemainingDays(getRemainingGuestDays(firstVisit));
    setExpired(isGuestExpired(firstVisit));
  }, [isLoggedIn]);

  return {
    /** mount 완료 여부 — false 면 SSR 단계로 보고 UI 가드. */
    mounted,
    /** 게스트 모드 남은 일수 (0~7). 만료 시 0. */
    remainingDays,
    /** 게스트 유예 기간 만료 여부. true 면 회원가입 강제. */
    expired,
  };
}
