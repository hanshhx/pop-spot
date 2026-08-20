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

/**
 * 확인 한 번의 결과를 반영해 다음 상태를 정한다. {@code null} 이면 지금 상태를 그대로 둔다.
 *
 * <p>이 판정이 배너 하나만 좌우하는 것이 아니다. 로그인 화면({@code app/login/page.tsx})과
 * 회원 API 차단({@code api.ts} 의 사전 차단)이 같은 값을 읽으므로, 여기서 한 번 깜빡이면
 * 사용자에게는 "서버가 또 나갔고 로그인도 풀렸다" 로 보인다.
 *
 * <p>그래서 실패는 <b>연속 2회</b>부터 장애로 본다. 확인 요청 한 번이 느려서 제한시간에
 * 걸리는 일은 흔한데, 그때마다 회원 기능을 끊으면 멀쩡한 서버가 고장 난 것처럼 보인다.
 * 진짜 장애는 다음 확인(15초 뒤)에도 실패하므로 15초 늦게 잡힐 뿐 놓치지 않는다.
 *
 * <p>반대 방향(복구)은 호출부가 더 엄격하게 본다 — 장애를 실제로 겪은 탭만 3연속 성공과
 * 60초 안정을 요구한다. 끊길 때보다 돌아올 때를 더 신중하게 보는 비대칭은 의도한 것이다.
 *
 * @param consecutiveFailures 이번 실패까지 포함한 연속 실패 횟수
 */
export function availabilityAfterFailure(consecutiveFailures: number): ServiceAvailability | null {
  return consecutiveFailures >= FAILURE_COUNT_TO_DECLARE_DOWN ? 'unavailable' : null;
}

/** 장애로 선언하기 전에 필요한 연속 실패 횟수. */
export const FAILURE_COUNT_TO_DECLARE_DOWN = 2;

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
