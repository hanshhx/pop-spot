/**
 * 소셜 로그인 교환 코드를 <b>이 브라우저에 묶기</b> 위한 값(RFC 7636).
 *
 * <p>로그인을 시작할 때 무작위 verifier 를 만들어 이 탭에만 두고, 그 해시(challenge)만 서버에
 * 보낸다. 돌아와서 교환할 때 verifier 를 함께 내면 서버가 대조한다. 콜백을 가로챈 쪽은 해시는
 * 볼 수 있어도 verifier 를 모르므로 코드를 쓸 수 없다.
 *
 * <p>왜 필요한가: 예전엔 서버가 {@code code} 만 보고 토큰을 내줬다. 앱이 만드는 nonce 는 정상 앱이
 * <b>위조된</b> 콜백을 걸러내는 장치인데 그 검사를 정상 앱이 자기 기기에서 하므로, 콜백을
 * <b>가로챈</b> 쪽은 그 검사를 건너뛰고 code 만 보내면 됐다. 서로 다른 공격이라 nonce 로는 못 막는다.
 *
 * <p>웹은 왜 위험이 낮은데도 함께 바꾸는가: 교환 엔드포인트가 웹·앱 공용이라, 서버가 나중에
 * 구방식 교환을 끊을 때 웹이 같이 끊긴다. 서버 지원 → 클라이언트 전환 → 구방식 종료 순서를
 * 지키려면 웹도 지금 넘어와야 한다.
 */

/** 이 탭의 verifier 를 두는 자리. sessionStorage 라 탭마다 다르다 — 여러 탭 로그인이 안 섞인다. */
const STORAGE_KEY = 'popspot:pkce-verifier';

/** RFC 7636 은 43~128자를 요구한다. 32바이트를 base64url 로 찍으면 43자다. */
const VERIFIER_BYTES = 32;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 이 브라우저가 쓸 수 있는지. {@code crypto.subtle} 은 보안 컨텍스트(https·localhost)에서만 있다.
 *
 * <p>없으면 챌린지 없이 시작한다 — 서버가 구방식으로 기록하고 전환 기간에는 그대로 로그인된다.
 * 여기서 로그인을 막지는 않는다.
 */
export function pkceAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto?.subtle?.digest === 'function' &&
    typeof window.crypto?.getRandomValues === 'function'
  );
}

/**
 * verifier 를 새로 만들어 이 탭에 두고, 서버에 보낼 challenge 를 돌려준다.
 *
 * @returns challenge(base64url 43자). 만들 수 없으면 null — 호출부는 챌린지 없이 시작한다.
 */
export async function startPkce(): Promise<string | null> {
  if (!pkceAvailable()) return null;
  try {
    const random = new Uint8Array(VERIFIER_BYTES);
    window.crypto.getRandomValues(random);
    const verifier = base64Url(random);

    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = base64Url(new Uint8Array(digest));

    // 저장이 먼저 성공해야 challenge 를 넘긴다. 순서가 반대면 서버는 묶었는데 우리는 열쇠가 없는
    // 상태가 되어, 그 사람의 로그인이 교환 단계에서 반드시 실패한다.
    window.sessionStorage.setItem(STORAGE_KEY, verifier);
    return challenge;
  } catch {
    // 저장이 막혔거나(시크릿 모드 등) 해시에 실패했다. 챌린지 없이 시작한다.
    return null;
  }
}

/**
 * 교환에 쓸 verifier 를 꺼내고 지운다.
 *
 * <p>한 번 쓰면 지우는 이유: 교환은 1회용이다. 남겨 두면 뒤로가기로 같은 화면에 돌아왔을 때 이미
 * 소비된 코드에 계속 붙게 된다.
 */
export function takeVerifier(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY);
    if (v) window.sessionStorage.removeItem(STORAGE_KEY);
    return v;
  } catch {
    return null;
  }
}

/** 시작하다 만 흐름의 찌꺼기를 치운다. 다른 방식으로 로그인할 때 부른다. */
export function clearVerifier(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장소가 막혀 있으면 애초에 남은 것도 없다 */
  }
}
