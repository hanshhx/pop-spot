const VISITOR_KEY = 'popspot:visitorId';
const VISITOR_CREATED_AT_KEY = 'popspot:visitorIdCreatedAt';
const VISITOR_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * 익명 방문자 ID(랜덤 UUID). PII 아님 — 개인 식별 불가.
 *
 * <p>방문 집계(중복 방문 구분)와 "지금 어때요?" 중복 제보 제한에 함께 쓴다.
 */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    const createdAt = Number(localStorage.getItem(VISITOR_CREATED_AT_KEY));
    const expired = !Number.isFinite(createdAt) || Date.now() - createdAt >= VISITOR_ID_MAX_AGE_MS;
    if (!id || expired) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(VISITOR_KEY, id);
      localStorage.setItem(VISITOR_CREATED_AT_KEY, String(Date.now()));
    }
    return id;
  } catch {
    return 'anon';
  }
}
