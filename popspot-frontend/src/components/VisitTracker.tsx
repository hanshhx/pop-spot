'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getAuthToken } from '@/lib/authStorage';

const VISITOR_KEY = 'popspot:visitorId';

/** 익명 방문자 ID(랜덤 UUID). PII 아님 — 개인 식별 불가, 단순 중복 방문 구분용. */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/**
 * 익명 방문 비콘.
 *
 * <p>로그인 여부(게스트/회원)와 경로만 서버에 남긴다. **IP·개인정보는 보내지 않음.**
 * 세션당 같은 경로는 1회만 전송(과다 기록 방지). 전송 실패(백엔드 미가동 등)는 조용히 무시.
 */
export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // 관리자/운영자(본인) 트래픽 제외 — 지표가 자체 접속으로 부풀려지지 않게.
    //  (1) /admin 경로  (2) JWT role=ADMIN  (3) notrack 플래그.
    // 한 번이라도 ADMIN 으로 확인된 브라우저는 이후(로그아웃/게스트 테스트 포함) 계속 제외한다.
    try {
      if (pathname.startsWith('/admin')) return;
      if (localStorage.getItem('popspot:notrack') === '1') return;
      const token = getAuthToken();
      const payloadPart = token?.split('.')[1];
      if (payloadPart) {
        const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
        if (payload?.role === 'ADMIN') {
          localStorage.setItem('popspot:notrack', '1');
          return;
        }
      }
    } catch {
      /* 판정 실패 시 정상 기록 진행 */
    }

    // 세션 내 같은 경로 중복 전송 방지.
    const sentKey = `popspot:visit:${pathname}`;
    try {
      if (sessionStorage.getItem(sentKey)) return;
      sessionStorage.setItem(sentKey, '1');
    } catch {
      /* sessionStorage 불가 시 그대로 진행 */
    }

    let guest = true;
    try {
      guest = !getAuthToken();
    } catch {
      /* 접근 불가 시 게스트로 간주 */
    }

    const body = JSON.stringify({
      visitorId: getVisitorId(),
      path: pathname.slice(0, 255),
      guest,
    });

    try {
      // 상대 경로 → 동일 출처 리라이트. 전역 마운트 + JSON POST 라 유일하게 매 페이지
      // preflight 를 유발하던 호출이었다. 동일 출처가 되면 preflight 자체가 사라진다.
      void fetch(`/api/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    } catch {
      /* 조용히 무시 */
    }
  }, [pathname]);

  return null;
}
