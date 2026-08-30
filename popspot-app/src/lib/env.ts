/**
 * 앱이 어디로 요청을 보내는가.
 *
 * <p><b>백엔드 호스트를 직접 부르지 않고 popspot.co.kr 을 거친다.</b> 스토어 배포본에서는 이 문자열이
 * 앱 안에 영구히 박히는데, VM 교체나 네트워크 재설정으로 Tailscale funnel 주소가 바뀌면 <b>설치된 앱이
 * 전부 죽고</b> 복구 수단이 스토어 재심사(수일)밖에 없다. popspot.co.kr 을 거치면 주소가 바뀌어도
 * Vercel 환경변수만 고치면 이미 설치된 앱까지 즉시 살아난다.
 *
 * <p>경로는 웹과 같은 것을 그대로 쓴다 — {@code popspot-frontend} 의 Route Handler 프록시가
 * {@code /api/:path*} 를 백엔드로 넘긴다.
 */

/**
 * 로컬 개발에서 다른 서버를 볼 때만 덮는다.
 *
 * <p><b>배포본에는 이 값을 넣지 않는다.</b> Expo 의 {@code EXPO_PUBLIC_*} 은 빌드 타임에 문자열로
 * 박히므로, 실수로 남기면 위에 적은 문제가 그대로 돌아온다.
 */
const OVERRIDE = process.env.EXPO_PUBLIC_API_BASE;

/**
 * 웹 사이트 주소 — <b>덮어쓰지 않는다.</b>
 *
 * <p>소셜 로그인이 {@code /oauth/start/{provider}} 를 여는데, 그 라우트는 백엔드가 아니라
 * <b>웹 프런트에만</b> 있다. 위 {@code OVERRIDE} 로 API 를 LAN 백엔드로 돌려 놓은 기기에서
 * {@code apiUrl} 로 그 주소를 만들면 존재하지 않는 곳을 열어 404 가 난다.
 *
 * <p>그래서 둘을 가른다 — API 는 덮을 수 있고, 웹 화면 주소는 언제나 운영이다.
 */
export const env = {
  apiUrl: OVERRIDE || 'https://popspot.co.kr',
  webUrl: 'https://popspot.co.kr',
} as const;

export const API_BASE_URL = env.apiUrl;
export const WEB_BASE_URL = env.webUrl;
