const VISITOR_KEY = "popspot:visitorId";

/**
 * 익명 방문자 ID(랜덤 UUID). PII 아님 — 개인 식별 불가.
 *
 * <p>방문 집계(중복 방문 구분)와 "지금 어때요?" 중복 제보 제한에 함께 쓴다.
 */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}
