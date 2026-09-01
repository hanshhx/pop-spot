'use client';

import { Analytics } from '@vercel/analytics/next';

import { resolveOptOut } from '@/lib/analyticsOptOut';

/**
 * Vercel 방문 통계 — <b>내 방문만 빼고</b> 보낸다.
 *
 * <p><b>왜 감싸는 컴포넌트가 필요한가.</b> {@code beforeSend} 는 함수라서 서버 컴포넌트인
 * {@code app/layout.tsx} 에서 바로 넘길 수 없다(서버에서 클라이언트로 함수는 못 건넌다).
 * 이 한 겹이 그 경계다.
 *
 * <p><b>왜 {@code useEffect} 로 미리 켜 두지 않는가.</b> 첫 페이지뷰가 효과보다 먼저 나갈 수
 * 있다. 그러면 주소로 켠 바로 그 방문 하나는 그대로 집계된다. {@code beforeSend} 안에서 매번
 * 확인하면 첫 번째 것부터 걸린다.
 *
 * <p><b>봇은 여기서 안 거른다.</b> Vercel 이 보내는 수집 스크립트가 이미
 * {@code navigator.webdriver} 와 {@code Headless} 를 걸러낸다. 사용자 에이전트 목록을 더 붙이면
 * 진짜 사용자를 잘못 뺄 위험만 커진다.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        if (typeof window === 'undefined') return event;
        try {
          return resolveOptOut(window.localStorage, window.location.search) ? null : event;
        } catch {
          /* 저장소 접근 자체가 막힌 브라우저. 판단이 안 서면 집계한다. */
          return event;
        }
      }}
    />
  );
}
