const VISITOR_KEY = 'popspot:visitorId';
const VISITOR_CREATED_AT_KEY = 'popspot:visitorIdCreatedAt';
const VISITOR_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * 저장소를 못 쓸 때 붙이는 접두어.
 *
 * <p>집계에서 <b>골라낼 수 있게</b> 하는 것이 전부다 — {@code visitor_id NOT LIKE 'eph-%'}.
 */
const EPHEMERAL_PREFIX = 'eph-';

function randomId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * 저장이 안 되는 환경에서 이 페이지가 쓸 임시 ID. <b>모듈에 한 번만</b> 만든다.
 *
 * <p>호출마다 새로 만들면 한 화면에서 일어난 행동들이 서로 다른 사람의 것으로 흩어진다.
 */
let ephemeralId: string | null = null;

/**
 * 익명 방문자 ID(랜덤 UUID). PII 아님 — 개인 식별 불가.
 *
 * <p>방문 집계(중복 방문 구분)와 "지금 어때요?" 중복 제보 제한에 함께 쓴다.
 *
 * <h3>저장소를 못 쓸 때</h3>
 *
 * <p>예전에는 문자열 {@code 'anon'} 하나를 돌려줬다. 그러면 저장소가 막힌 사람들이 <b>전부 한
 * 명으로 합쳐진다.</b> 고유 방문자는 실제보다 적게 세어지고, 그 한 명은 여러 날 여러 세션에
 * 걸쳐 모든 경로를 다녀간 <b>초강력 재방문자</b>로 잡혀 재방문율까지 부풀린다.
 *
 * <p>그렇다고 매번 새 UUID 를 주면 반대로 기운다 — 페이지를 열 때마다 새 사람이 되어 고유
 * 방문자가 부풀고, 진짜 방문자와 구분할 방법이 없어 빼낼 수도 없다.
 *
 * <p>그래서 접두어를 붙인 임시 ID 를 준다. 서로 합쳐지지도, 진짜와 섞이지도 않는다 —
 * 집계에서 한 줄로 제외할 수 있고({@code NOT LIKE 'eph-%'}), 총 행동 횟수는 그대로 남는다.
 * {@code visitor_id} 는 NOT NULL 이라 null 을 보내려면 마이그레이션이 필요한데, 이 방식은
 * 스키마를 건드리지 않는다.
 *
 * <p>실패하는 경우는 시크릿 모드만이 아니다 — 저장소 차단 설정, 브라우저 정책, 용량 초과,
 * 보안 오류에서도 던진다.
 */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    const createdAt = Number(localStorage.getItem(VISITOR_CREATED_AT_KEY));
    const expired = !Number.isFinite(createdAt) || Date.now() - createdAt >= VISITOR_ID_MAX_AGE_MS;
    if (!id || expired) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
      localStorage.setItem(VISITOR_CREATED_AT_KEY, String(Date.now()));
    }
    return id;
  } catch {
    ephemeralId ??= `${EPHEMERAL_PREFIX}${randomId()}`;
    return ephemeralId;
  }
}

/**
 * 이 ID 가 <b>사람을 가리키지 못하는</b> 것인가.
 *
 * <p>고유 방문자·재방문율처럼 사람 수를 세는 계산에서는 빼야 한다. 총 행동 횟수처럼 사람과
 * 무관한 수치에는 그대로 둔다.
 */
export function isEphemeralVisitorId(id: string): boolean {
  return id.startsWith(EPHEMERAL_PREFIX);
}
