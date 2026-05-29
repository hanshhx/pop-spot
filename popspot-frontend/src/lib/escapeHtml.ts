/**
 * HTML escape — 신뢰할 수 없는 문자열을 raw HTML(innerHTML / SDK content 문자열)에 끼워 넣기 전
 * 반드시 통과시킨다.
 *
 * <p>주 용도: Kakao Map / Roadview 의 `CustomOverlay({ content })` 처럼 문자열을 그대로 DOM 에
 * 삽입하는 외부 SDK. 팝업 이름 등은 자동수집(크롤러)이 외부 검색결과에서 가져온 비신뢰 데이터라
 * `<img src=x onerror=...>` 같은 페이로드가 섞일 수 있어 저장형 XSS 로 이어진다.
 *
 * <p>React 의 일반 텍스트 렌더(`{value}`)는 자동 escape 되므로 이 함수가 필요 없다. 오직 raw HTML
 * 문자열을 직접 만들 때만 사용한다.
 */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
