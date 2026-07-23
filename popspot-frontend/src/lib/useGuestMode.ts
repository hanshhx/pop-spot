'use client';

import { useEffect, useState } from 'react';
import {
  clearGuestMode,
  getGuestFirstVisit,
  getRemainingGuestDays,
  isGuestExpired,
} from './guestMode';

/**
 * 게스트 모드 상태를 컴포넌트에서 쉽게 쓰기 위한 훅 — v2.7 read-only 화.
 *
 * <p>이전 구현은 비로그인 사용자가 이 훅을 부르는 순간 자동으로 7일 카운터를 시작했다. 이제는 사용자가
 * 로그인 페이지에서 명시적으로 "게스트로 로그인하기" 를 눌러 {@link import("./guestMode").startGuestMode}
 * 를 호출해야만 카운터가 돈다. 이 훅은 그 결과만 읽어와 UI 에 노출하는 역할.
 *
 * <p>SSR 단계에선 hydration mismatch 회피용으로 모든 값이 기본값. mount 이후 실제 값으로 갱신.
 *
 * @param isLoggedIn 사용자 로그인 여부 — 로그인 시엔 게스트 잔재가 있으면 정리한다.
 */
export function useGuestMode(isLoggedIn: boolean) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [remainingDays, setRemainingDays] = useState(7);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isLoggedIn) {
      // 로그인 사용자는 게스트 추적 불필요. 잔재가 있으면 정리.
      clearGuestMode();
      setActive(false);
      setExpired(false);
      return;
    }
    const firstVisit = getGuestFirstVisit();
    setActive(firstVisit != null);
    setRemainingDays(getRemainingGuestDays(firstVisit));
    setExpired(isGuestExpired(firstVisit));
  }, [isLoggedIn]);

  return {
    /** mount 완료 여부 — false 면 SSR 단계로 보고 UI 가드. */
    mounted,
    /** 게스트 모드가 시작되었고 만료 전 — true 일 때만 D-N pill 같은 UI 노출. */
    active,
    /** 게스트 모드 남은 일수 (0~7). 미시작 / 만료 시 의미 없음 (각각 7, 0). */
    remainingDays,
    /** 게스트 유예 기간 만료 여부. true 면 회원가입 강제. */
    expired,
  };
}
