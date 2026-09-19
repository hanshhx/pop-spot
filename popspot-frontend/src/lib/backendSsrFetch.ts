/**
 * 서버 렌더가 백엔드를 부를 때 쓰는 {@code fetch} — <b>이름 해석에 실패하면 한 번 더 시도한다.</b>
 *
 * <p><b>왜 필요한가.</b> Vercel 함수 안에서 백엔드({@code *.ts.net})의 이름 해석이 통째로 실패하는
 * 구간이 있다(경위는 {@link createBackendLookup}). {@code /api/*} 프록시는 이미 그것을 우회하지만
 * <b>서버 렌더는 프록시를 안 거친다</b> — 홈·랜딩·상세가 백엔드를 직접 부른다. 그래서 그 구간에
 * 크롤러가 오면 2026-08-11 스냅샷이 나갔다. 사람에게는 오래된 목록이고, 검색엔진에게는
 * "이 사이트는 안 고쳐진다" 는 신호다.
 *
 * <p><b>왜 {@code fetch} 를 버리지 않는가.</b> 세 호출부가 전부 {@code next: { revalidate }} 로
 * Next 의 데이터 캐시를 쓴다(1시간·1시간·5분). {@code node:https} 로 통째로 내려가면 그 캐시가
 * 사라져 <b>크롤러가 몰릴 때마다 백엔드를 직접 두드리게</b> 된다.
 *
 * <p>그래서 평소에는 {@code fetch} 그대로 두고, <b>이름을 못 풀었을 때만</b> 우회로로 한 번 더
 * 시도한다. 정상 구간에서는 코드 경로가 예전과 완전히 같다.
 */

/** 빌드 중에는 더 짧게 끊는다 — 아래 '빌드는 백엔드를 기다리지 않는다' 참고. */
const BUILD_TIMEOUT_MS = 4_000;

/**
 * 빌드 중 연달아 이만큼 실패하면 <b>그 빌드 동안 백엔드를 포기한다.</b>
 *
 * <p>한 번으로 끊지 않는 이유는 순간적인 네트워크 딸꾹질 때문이다. 그것 하나로 SEO 페이지
 * 전체가 스냅샷으로 만들어지면 손해가 크다. 반대로 백엔드가 진짜 죽었으면 세 번이면 충분히
 * 드러난다.
 */
const BUILD_GIVE_UP_AFTER = 3;

/** Next 가 프로덕션 빌드를 시작할 때 넣는 값(next/dist/build/index.js). */
const PHASE_PRODUCTION_BUILD = 'phase-production-build';

function isBuilding(): boolean {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
}

/**
 * <b>빌드는 백엔드를 기다리지 않는다.</b>
 *
 * <p>2026-09-01 배포가 이것 때문에 통째로 실패했다. 백엔드가 있는 기계가 죽자 SEO 페이지 887개가
 * <b>각자</b> 백엔드를 부르며 매번 10초 넘게 기다렸고, Next 의 페이지당 60초 제한을 넘겨 세 번
 * 재시도한 끝에 빌드가 죽었다.
 *
 * <p>핵심은 <b>성공만 캐시된다</b>는 점이다. Next 의 데이터 캐시는 같은 요청을 한 번만 보내지만,
 * <b>실패는 아무도 기억하지 않아서</b> 887번을 처음부터 되풀이한다. 그래서 시간을 줄이는 것만으로는
 * 부족하고, 실패를 기억해야 한다.
 *
 * <p>호출부는 전부 이미 스냅샷·빈 값으로 물러설 준비가 돼 있다(loadPublicMarkers 등). 즉 <b>느리게
 * 실패하느냐 빠르게 실패하느냐</b>의 문제였지 결과의 문제가 아니었다. 배포까지 같이 막히는 쪽이
 * 훨씬 나쁘다 — 백엔드가 죽은 날은 고칠 것을 내보내야 하는 날이기도 하다.
 */
let consecutiveBuildFailures = 0;

/** 이 빌드에서 백엔드를 포기했는가. */
function backendGivenUp(): boolean {
  return isBuilding() && consecutiveBuildFailures >= BUILD_GIVE_UP_AFTER;
}

function noteBuildOutcome(failed: boolean): void {
  if (!isBuilding()) return;
  if (!failed) {
    consecutiveBuildFailures = 0;
    return;
  }
  consecutiveBuildFailures += 1;
  if (consecutiveBuildFailures === BUILD_GIVE_UP_AFTER) {
    console.warn(
      `[ssr] 빌드 중 백엔드가 ${BUILD_GIVE_UP_AFTER}번 연속 실패해 남은 페이지는 저장된 자료로 만든다.`,
    );
  }
}

/**
 * 검사에서 상태를 되돌린다. 모듈 하나에 쌓이는 값이라 앞선 검사가 뒤 검사를 오염시킨다.
 *
 * <p>운영 코드에서 부르는 곳은 없다.
 */
export function resetBackendBuildState(): void {
  consecutiveBuildFailures = 0;
}

/**
 * 오류에서 코드를 꺼낸다. {@code fetch}(undici)는 한 겹 안쪽 {@code cause.code} 에,
 * {@code node:https} 는 {@code code} 에 담는다.
 */
export function errorCode(error: unknown): string | undefined {
  const nested = (error as { cause?: { code?: unknown } })?.cause?.code;
  if (typeof nested === 'string') return nested;
  const direct = (error as { code?: unknown })?.code;
  return typeof direct === 'string' ? direct : undefined;
}

/**
 * 서버 렌더용 백엔드 호출. 실패하면 던진다 — 호출부가 이미 {@code try/catch} 로 스냅샷·빈 값으로
 * 물러설 준비가 되어 있으므로, 여기서 삼키면 그 판단을 빼앗는다.
 */
export async function fetchBackend(url: string, revalidate: number): Promise<Response> {
  if (backendGivenUp()) {
    throw new Error('[ssr] 이 빌드에서 백엔드를 이미 포기했다');
  }

  const building = isBuilding();

  try {
    /*
     * 빌드에서만 시간을 못 박는다. 운영에서는 undici 기본값을 그대로 둔다 — 여기서 더 짧게
     * 끊으면 백엔드가 느리기만 한 순간에도 방문자에게 저장된 자료를 보여주게 된다.
     */
    const response = await fetch(url, {
      next: { revalidate },
      ...(building ? { signal: AbortSignal.timeout(BUILD_TIMEOUT_MS) } : {}),
    });
    noteBuildOutcome(false);
    return response;
  } catch (error) {
    noteBuildOutcome(true);
    throw error;
  }
}
