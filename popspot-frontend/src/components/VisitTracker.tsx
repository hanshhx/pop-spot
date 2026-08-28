'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/authStorage';
import { getVisitorId } from '@/lib/visitorId';

/** 이 세션에서 유입 경로(referrer)를 이미 보냈는지. sessionStorage 라 탭 단위·닫으면 초기화. */
const REFERRER_SENT_KEY = 'popspot:referrerSent';

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
    // 이 세션의 첫 진입인가 — referrer 와 UTM 이 같은 판정을 쓴다. 따로 두면 한쪽만 첫 진입으로
    // 잡혀 유입 출처와 캠페인의 집계 기준이 어긋난다.
    let firstEntryOfSession = true;
    try {
      if (sessionStorage.getItem(REFERRER_SENT_KEY)) {
        firstEntryOfSession = false;
        referrer = window.location.origin;
      } else {
        sessionStorage.setItem(REFERRER_SENT_KEY, '1');
        referrer = document.referrer || '';
      }
    } catch {
      // sessionStorage 불가(시크릿·차단) → 첫 진입 판정을 못 하니 있는 그대로 보낸다.
      referrer = document.referrer || '';
    }

    // 유입 캠페인(UTM) — referrer 와 <b>같은 규칙</b>으로 세션 첫 진입에만 보낸다.
    //
    // 매 경로 변경마다 실으면 많이 돌아다닌 방문자 한 명이 캠페인 순위를 통째로 흔든다.
    // 그리고 SPA 라 주소창의 utm 파라미터는 첫 진입 뒤 사라지므로, 어차피 그때만 읽을 수 있다.
    //
    // 값은 백엔드가 허용 문자만 남기고 자른다 — 주소창으로 오는 값이라 무엇이든 올 수 있다.
    // 전체 쿼리스트링은 보내지 않는다(검색어·토큰이 실릴 수 있고, 방침에도 캠페인 식별자만 적었다).
    let utm: Record<string, string> = {};
    if (firstEntryOfSession) {
      try {
        const params = new URLSearchParams(window.location.search);
        const source = params.get('utm_source');
        if (source) {
          utm = {
            utmSource: source.slice(0, 100),
            ...(params.get('utm_medium')
              ? { utmMedium: params.get('utm_medium')!.slice(0, 100) }
              : {}),
            ...(params.get('utm_campaign')
              ? { utmCampaign: params.get('utm_campaign')!.slice(0, 100) }
              : {}),
          };
        }
      } catch {
        /* 주소를 못 읽어도 방문 기록은 남긴다 */
      }
    }

    const body = JSON.stringify({
      visitorId: getVisitorId(),
      path: pathname.slice(0, 255),
      guest,
      ...utm,
      // 빈 문자열이면 생략 — 백엔드가 없음/빈 값을 모두 "direct" 로 분류한다.
      // 백엔드는 호스트만 저장하지만(쿼리스트링에 검색어가 실릴 수 있어서) 비콘 본문이
      // 무한정 커지지 않게 여기서도 잘라 보낸다.
      ...(referrer ? { referrer: referrer.slice(0, 512) } : {}),
    });

    try {
      // 주소 결정은 apiFetch 와 같은 규칙(apiUrl)을 쓴다. 동일 출처면 preflight 가 없고,
      // 리라이트가 깨진 운영 출처에서만 직행한다 — 그때는 JSON POST 라 preflight 가 붙지만
      // 백엔드가 Access-Control-Max-Age: 3600 을 주므로 한 시간에 한 번이다.
      //
      // 이 호출은 조용히 실패하도록 되어 있어(.catch) 깨져도 화면에 아무 증상이 없다.
      // 방문 수만 0 이 된다 — 가장 늦게 발견되는 종류의 고장이라 여기를 빠뜨리면 안 됐다.
      void fetch(apiUrl('/api/visits'), {
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
