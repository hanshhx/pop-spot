/**
 * 소셜 로그인 흐름을 <b>앱이 시작했는지</b> 표시하는 쿠키 하나.
 *
 * <p>백엔드 {@code OAuth2SuccessHandler} 는 성공하면 {@code app.oauth2.redirect-uri}
 * <b>한 곳으로만</b> 되돌린다(웹 주소). 앱에서 시작했든 웹에서 시작했든 같은 자리로 오기 때문에,
 * "이 흐름은 앱이 시작했다" 를 흐름 내내 들고 다닐 것이 필요하다. 그게 이 쿠키다.
 *
 * <p>여기 있는 이유는 <b>서버(Route Handler)와 클라이언트(콜백·로그인 페이지)가 같은 이름을 써야</b>
 * 하기 때문이다. 라우트 파일에서 가져오면 {@code next/server} 가 클라이언트 번들로 딸려 들어온다.
 *
 * <p>쿠키 값은 앱이 만든 <b>1회용 난수</b>다({@code nonce}). 비밀이 아니라 <b>짝 맞추기</b>용이라
 * {@code httpOnly} 가 아니어도 되고, 오히려 아니어야 콜백 페이지가 읽는다 — 쓰임은 아래 참고.
 */
export const APP_FLOW_COOKIE = 'popspot_oauth_app';

/**
 * 쿠키가 사는 경로 — <b>사이트 전체</b>여야 한다.
 *
 * <p>처음에는 {@code /oauth} 로 좁혔다. 심는 곳과 읽는 곳이 둘 다 그 아래라 충분해 보였는데,
 * <b>실패는 그 아래로 오지 않는다.</b> 사용자가 카카오 동의 화면에서 취소하면 스프링의
 * {@code failureUrl} 이 {@code /login?error} 로 보낸다(SecurityConfig). 브라우저는 경로가 안 맞는
 * 쿠키를 그 요청에 싣지도, {@code document.cookie} 로 보여주지도 않으므로 <b>로그인 페이지가
 * "앱에서 왔다" 를 알 방법이 없고</b>, 앱은 영영 기다린다.
 *
 * <p>값은 짧은 난수 하나뿐이고 수명이 5분이라 전 경로에 실려도 잃을 것이 없다.
 */
export const APP_FLOW_COOKIE_PATH = '/';

/**
 * 쿠키 수명.
 *
 * <p>시계는 <b>사용자가 소셜 버튼을 누른 순간부터</b> 돈다 — 카카오에서 비밀번호를 찾거나 문자
 * 인증을 하는 시간이 전부 여기 들어간다. 짧게 잡으면 그 사람이 로그인을 <b>마친 뒤에</b> 쿠키가
 * 먼저 죽어서, 콜백이 "웹 흐름" 으로 알고 브라우저가 코드를 써 버린다. 앱에는 아무것도 오지 않고
 * 코드는 1회성이라 그걸로 끝이다.
 *
 * <p>반대 위험(남아서 웹 로그인을 앱으로 튕김)은 <b>지우는 곳을 늘려</b> 막았다 — 콜백의 모든
 * 분기, 로그인 화면 진입, 소셜 버튼에서 전부 지운다. 앱 쪽 난수 유효기간도 같은 30분이다.
 */
export const APP_FLOW_COOKIE_MAX_AGE_SECONDS = 1800;

/** 앱이 돌아갈 커스텀 스킴. 앱 {@code socialAuth.ts} 의 같은 상수와 맞아야 한다. */
export const APP_RETURN_SCHEME = 'popspot://auth';

/**
 * 콜백이 실제로 넘기는 주소 — <b>검증된 https 링크</b>(Android App Links).
 *
 * <p>App Links 가 검증된 기기에서는 안드로이드가 이 주소를 <b>열지 않고 앱에 바로 넘긴다.</b>
 * 커스텀 스킴과 달리 다른 앱이 등록해 가로챌 수 없다. 아직 그 인텐트 필터가 없는 빌드에서는
 * 이 주소가 그냥 열리고, 그 페이지({@code app/app/auth/route.ts})가 {@code popspot://} 로 넘긴다 —
 * <b>지금도 되고, 다음 빌드에서 저절로 더 안전해진다.</b>
 */
export const APP_RETURN_LINK = 'https://popspot.co.kr/app/auth';

/**
 * 이 브라우저 흐름을 앱이 시작했는가 — 시작했으면 앱이 준 난수를 돌려준다.
 *
 * <p>그 값을 앱에 되돌려 주면 앱이 <b>자기가 시작한 로그인인지</b> 확인할 수 있다. 안드로이드의
 * 커스텀 스킴은 독점이 아니라서, 이것이 없으면 남이 만든
 * {@code popspot://auth?code=<공격자 코드>} 링크 하나로 피해자가 공격자 계정에 로그인된다
 * (이 저장소가 v2.40 에 {@code ?token=} 경로를 지운 것과 같은 위협이다 — 콜백 페이지 주석 참고).
 */
export function appFlowNonce(): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${APP_FLOW_COOKIE}=`));
  if (!hit) return null;
  const value = hit.slice(APP_FLOW_COOKIE.length + 1);
  return value || null;
}

/** 앱에서 시작한 흐름인가. */
export function startedByApp(): boolean {
  return appFlowNonce() !== null;
}

/**
 * 표시를 지운다.
 *
 * <p>읽은 <b>모든</b> 곳에서 부른다 — 콜백(성공·실패 무관)과 로그인 화면. 한 군데라도 빠뜨리면
 * 그 경로로 끝난 사람의 다음 웹 로그인이 앱으로 튕긴다.
 */
export function clearAppFlowCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${APP_FLOW_COOKIE}=; Path=${APP_FLOW_COOKIE_PATH}; Max-Age=0; SameSite=Lax`;
}

/**
 * 앱으로 돌아갈 주소를 만든다.
 *
 * <p>난수를 함께 실어 보낸다 — 앱이 자기가 시작한 흐름인지 확인하는 근거다.
 */
export function appReturnUrl(params: Record<string, string | null>): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== null && entry[1] !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `${APP_RETURN_LINK}?${query}` : APP_RETURN_LINK;
}
