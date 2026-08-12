/**
 * 백엔드 가용 상태를 브라우저 탭 전체가 공유한다.
 *
 * 서버 전원이 나가면 한 화면의 API 열 개가 각각 재시도해 게이트웨이를 수십 번 두드렸다. 상태를
 * 한곳에 모아 장애가 확인된 동안은 나머지 요청을 즉시 503으로 끝내고, 별도 상태 확인만 서버 복구를
 * 기다리게 한다. 회원 토큰은 지우지 않는다 — 서버 장애는 로그인 만료가 아니다.
 */
export type ServiceAvailability = 'checking' | 'available' | 'unavailable';

export const SERVICE_AVAILABILITY_EVENT = 'popspot:service-availability';

let current: ServiceAvailability = 'checking';
const listeners = new Set<() => void>();

export function getServiceAvailability(): ServiceAvailability {
  return current;
}

export function getServerServiceAvailability(): ServiceAvailability {
  return 'checking';
}

export function subscribeServiceAvailability(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setServiceAvailability(next: ServiceAvailability): void {
  if (current === next) return;
  current = next;
  for (const listener of listeners) listener();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SERVICE_AVAILABILITY_EVENT, { detail: next }));
  }
}

export function serviceUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Service Unavailable',
      message:
        '현재 서버 전원 장애로 일부 기능을 사용할 수 없습니다. 복구되면 자동으로 연결됩니다.',
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '15' },
    },
  );
}

/** 테스트 사이에 모듈 전역 상태가 새어 나가지 않게 하는 전용 초기화. */
export function resetServiceAvailabilityForTest(): void {
  current = 'checking';
  listeners.clear();
}
