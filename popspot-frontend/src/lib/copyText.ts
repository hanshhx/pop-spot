/**
 * 글자를 클립보드로. 안 되면 예전 방식으로 한 번 더 시도한다.
 *
 * <p>{@code navigator.clipboard} 만 믿을 수 없다. 세 가지 경우에 없거나 막힌다 —
 * https 가 아닐 때(아예 {@code undefined}), 문서에 포커스가 없을 때
 * ({@code NotAllowedError}), 그리고 <b>인앱 브라우저</b>. 마지막 것이 이 서비스에서 제일 크다:
 * 팝업 정보는 카카오톡으로 공유되고, 링크를 받은 사람은 카카오톡 안의 브라우저로 연다.
 *
 * <p>{@code document.execCommand('copy')} 는 표준에서 빠졌지만 그 환경들에서 아직 동작한다.
 * 새 방식이 실패했을 때만 쓰므로, 언젠가 정말 사라져도 지금보다 나빠지지 않는다.
 */
export async function copyText(text: string): Promise<boolean> {
  const value = text?.trim();
  if (!value) return false;

  try {
    // navigator.clipboard 자체가 없으면 여기서 TypeError 가 나고 아래로 떨어진다.
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return legacyCopy(value);
  }
}

/**
 * 화면 밖에 잠깐 만든 textarea 를 골라 복사한다.
 *
 * <p>{@code display: none} 이면 선택이 안 된다 — 보이지 않는 요소는 고를 수 없다. 그래서
 * 숨기지 않고 화면 밖으로 밀어낸다. {@code readOnly} 는 모바일에서 키보드가 올라오는 것을 막고,
 * {@code fontSize: 16px} 은 iOS 가 작은 글씨 입력칸에 자동으로 확대하는 것을 막는다.
 */
function legacyCopy(value: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;

  const area = document.createElement('textarea');
  area.value = value;
  area.readOnly = true;
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;';

  const active = document.activeElement as HTMLElement | null;
  document.body.appendChild(area);

  try {
    area.select();
    area.setSelectionRange(0, value.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    // 누르기 전에 있던 자리로 포커스를 돌려 놓는다. 안 그러면 키보드로 쓰던 사람이
    // 목록 맨 위로 튕긴다.
    active?.focus?.();
  }
}
