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

/**
 * 장애 판정이 스스로 풀리기까지의 시간.
 *
 * <p><b>이 값이 없을 때 무슨 일이 있었나.</b> 예전에는 {@code 'unavailable'} 이 <b>한 번 걸리면 그
 * 탭에서 영영 안 풀렸다</b>. 고리가 닫혀 있었기 때문이다 —
 *
 * <ol>
 *   <li>{@code apiFetch} 가 502 를 받으면 여기를 {@code 'unavailable'} 로 바꾼다.
 *   <li>그 뒤로 {@code apiFetch} 는 맨 위에서 즉시 503 을 돌려주고 <b>요청을 아예 안 보낸다.</b>
 *   <li>그런데 판정을 푸는 코드는 "응답이 500 미만이면 available" 이다. 요청을 안 보내니 응답이
 *       올 수 없고, 따라서 풀릴 수 없다.
 * </ol>
 *
 * <p>빠져나올 길은 {@link shouldRunHealthCheck} 의 폴링 하나였는데 그것은 2026-08-21 에 꺼졌다
 * (아래 주석 참고). 실측(2026-08-30)으로도 확인했다 — 홈을 열었을 때 나가는 API 는
 * {@code chat/ticker}·{@code congestion}·{@code spotify/me} 뿐이고 {@code /service-health} 는 없다.
 *
 * <p>그래서 관리자 화면처럼 요청을 한꺼번에 여러 개 보내는 곳이 제일 먼저, 그리고 통째로 잠겼다.
 * 서버는 멀쩡한데 새로고침 전까지 아무것도 안 되는 상태가 된다.
 *
 * <p>유효기간을 두면 원래 목적은 지키면서 그 고리가 열린다 — 장애가 몰아치는 30초 동안은 게이트웨이를
 * 두들기지 않고, 그 뒤에는 다시 시도해 본다. 서버가 살아났으면 첫 성공이 {@code 'available'} 로
 * 되돌리고, 아직 죽어 있으면 다시 30초 잠긴다.
 */
const UNAVAILABLE_TTL_MS = 30_000;

/** 유효기간 타이머. 판정이 바뀔 때마다 정리한다. */
let unavailableTimer: ReturnType<typeof setTimeout> | undefined;

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

  /*
   * 시간이 지나면 저절로 풀리게 한다. 근거는 UNAVAILABLE_TTL_MS 주석에 있다.
   *
   * 값을 읽는 쪽이 시계를 보게 하지 않고 <b>진짜 상태 전이</b>로 푼다 — 배너가
   * useSyncExternalStore 로 이 값을 읽는데, 알림 없이 반환값만 달라지면 React 가 스냅샷이
   * 흔들린다고 보고 어긋난 화면을 그린다.
   */
  if (unavailableTimer) {
    clearTimeout(unavailableTimer);
    unavailableTimer = undefined;
  }
  if (next === 'unavailable' && typeof window !== 'undefined') {
    unavailableTimer = setTimeout(() => setServiceAvailability('checking'), UNAVAILABLE_TTL_MS);
  }

  for (const listener of listeners) listener();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SERVICE_AVAILABILITY_EVENT, { detail: next }));
  }
}

/**
 * 상태 확인을 돌릴지 여부. <b>기본은 꺼짐이다.</b>
 *
 * <p>2026-08-21 에 껐다. 확인이 실패해 "서버 일시 중단" 이 뜨는 일이 계속 있었는데, 정작 서버는
 * 멀쩡했다. 확인 요청 자체를 가볍게 고쳐도 실측 실패율이 12회 중 4회였다 — 사용자에게는 멀쩡한
 * 서비스가 하루에 몇 번씩 고장 난 것처럼 보인다는 뜻이다. 없는 장애를 알리는 것보다 알리지 않는
 * 편이 낫다고 판단했다.
 *
 * <p>지우지 않고 스위치로 둔 이유는 이 장치가 원래 풀던 문제가 진짜이기 때문이다 — 서버 전원이
 * 나가면 한 화면의 API 열 개가 각자 재시도해 게이트웨이를 수십 번 두드린다. 서버가 실제로 죽으면
 * 아래 값을 <code>true</code> 로 바꾸고 배포하면 그대로 돌아온다.
 *
 * <p>꺼져 있는 동안 상태는 {@code 'checking'} 에 머문다. 이 값을 읽는 세 곳(배너·로그인 화면·
 * {@code api.ts} 의 사전 차단)은 모두 {@code 'unavailable'} 일 때만 반응하므로, 꺼두면 셋 다
 * 평소대로 동작한다.
 */
export function shouldRunHealthCheck(): boolean {
  return process.env.NEXT_PUBLIC_SERVICE_HEALTH_ENABLED === 'true';
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

/**
 * 장애로 선언하기 전에 필요한 연속 실패 횟수.
 *
 * <p>2 에서 3 으로 올렸다(2026-08-21). 2 로도 깜빡임은 크게 줄었지만 하루에 몇 번은 떴는데,
 * 원인이 확인 요청 자체에 있었다 — 상태 확인이 매번 341KB 짜리 목록을 받아 오느라 2코어 서버를
 * 눌렀고, 그 지연이 5초 제한을 넘겨 <b>확인이 스스로 만든 부하로 실패</b>했다. 그 비용은
 * {@code app/service-health/route.ts} 에서 없앴다(대표 id 를 기억해 133바이트만 받는다).
 *
 * <p>여기서 한 칸 더 올리는 것은 그 위에 얹는 여유분이다. 대가는 진짜 장애를 15초 늦게 잡는 것인데,
 * 이 신호가 켜는 것은 안내 배너와 회원 API 사전 차단이라 15초 늦어도 잃는 것이 거의 없다.
 * 반대로 잘못 켜지면 사용자는 "서버가 또 나갔다" 로 읽는다.
 */
export const FAILURE_COUNT_TO_DECLARE_DOWN = 3;

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
  if (unavailableTimer) {
    clearTimeout(unavailableTimer);
    unavailableTimer = undefined;
  }
}

/** 유효기간 값. 테스트가 시계를 그만큼 돌리는 데 쓴다. */
export const UNAVAILABLE_TTL_MS_FOR_TEST = UNAVAILABLE_TTL_MS;
