import type { DashboardSnapshot } from '@/components/admin/metrics/useDashboardMetrics';

/**
 * 관리자 화면의 순수 함수들 — 상태를 건드리지 않는다.
 *
 * <p>v2.53 — app/admin/page.tsx 에서 분리했다. 동작은 그대로다.
 */

/** 로컬 미리보기 여부 — dev 빌드이거나 localhost 접속. 프로덕션(실도메인)에서는 항상 false. */
export function isPreviewEnv() {
  if (process.env.NODE_ENV === 'development') return true;
  return (
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  );
}

/**
 * 통합 메트릭 (`/api/admin/metrics/dashboard`) 응답을 차트 점 1 개로 압축.
 * useDashboardMetrics 훅이 매 폴링마다 호출한다.
 */
export function toLinePoint(s: DashboardSnapshot, now: Date): Record<string, number | string> {
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return {
    time,
    heapMb: Number(s.jvm?.heapUsedMb ?? 0),
    httpRps: Number(s.http?.requestCount ?? 0),
  };
}

/** UA 에 흔한 브라우저 토큰이 하나도 없으면 봇 의심(강화 필터를 통과했더라도 눈으로 확인용). */
export function uaLooksBot(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return !/(chrome|crios|firefox|fxios|safari|edg|samsungbrowser|whale|opr|trident|msie|naver|kakao)/i.test(
    ua,
  );
}
