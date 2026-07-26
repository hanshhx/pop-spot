'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getAuthToken } from '@/lib/authStorage';

const VISITOR_KEY = 'popspot:visitorId';
/** 이 세션에서 유입 경로(referrer)를 이미 보냈는지. sessionStorage 라 탭 단위·닫으면 초기화. */
const REFERRER_SENT_KEY = 'popspot:referrerSent';

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
 * <p>로그인 여부(게스트/회원)·경로·유입 경로(referrer)만 서버에 남긴다. **IP·개인정보는 보내지 않음.**
 * referrer 도 백엔드가 호스트만 추려 저장한다(전체 URL 미저장 — 쿼리스트링에 검색어가 실릴 수 있음).
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

    // 유입 경로(referrer) — 세션당 "첫 진입" 1 회만 실제 값을 보낸다.
    //
    // 이 서비스는 App Router SPA 라 탭 이동이 history.pushState 로만 처리된다. document 가
    // 교체되지 않으므로 **document.referrer 는 세션 내내 최초 유입 값 그대로 남는다**(직접
    // 진입이었다면 계속 빈 문자열). 그래서 매 경로 변경마다 그대로 실어 보내면 같은 유입원이
    // 페이지뷰 수만큼 중복 집계돼, 많이 돌아다닌 방문자 한 명이 유입 순위를 통째로 흔든다.
    // 유입 경로는 "이 방문자가 어디서 왔나" 라 세션당 1 회가 맞다.
    //
    // 2 회차부터는 우리 출처(origin)를 보내 백엔드가 "internal"(사이트 내 이동)로 분류하게 한다.
    // 집계 API 가 internal 을 제외하므로 순위에 영향이 없다. referrer 를 아예 빼면 백엔드가
    // 없음/빈 값을 "direct" 로 보기 때문에 직접 방문이 페이지뷰만큼 부풀려진다 — 그래서 생략 대신 origin.
    let referrer = '';
    try {
      if (sessionStorage.getItem(REFERRER_SENT_KEY)) {
        referrer = window.location.origin;
      } else {
        sessionStorage.setItem(REFERRER_SENT_KEY, '1');
        referrer = document.referrer || '';
      }
    } catch {
      // sessionStorage 불가(시크릿·차단) → 첫 진입 판정을 못 하니 있는 그대로 보낸다.
      referrer = document.referrer || '';
    }

    const body = JSON.stringify({
      visitorId: getVisitorId(),
      path: pathname.slice(0, 255),
      guest,
      // 빈 문자열이면 생략 — 백엔드가 없음/빈 값을 모두 "direct" 로 분류한다.
      // 백엔드는 호스트만 저장하지만(쿼리스트링에 검색어가 실릴 수 있어서) 비콘 본문이
      // 무한정 커지지 않게 여기서도 잘라 보낸다.
      ...(referrer ? { referrer: referrer.slice(0, 512) } : {}),
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
