import { Linking } from 'react-native';

import { apiFetch } from '@/lib/api';
import {
  getPendingNonce,
  setAuthToken,
  setPendingNonce,
  setRefreshToken,
  setStoredUser,
} from '@/lib/authStorage';
import { WEB_BASE_URL } from '@/lib/env';
import type { User } from '@/types/popup';
import type { AuthResult } from './authApi';

/**
 * 소셜 로그인 — 카카오·네이버·구글.
 *
 * <h3>왜 이런 모양인가</h3>
 *
 * <p>백엔드 {@code OAuth2SuccessHandler} 는 로그인이 끝나면 {@code app.oauth2.redirect-uri}
 * <b>한 곳으로만</b> 되돌린다. 그 값은 웹 주소라, 앱이 아무리 잘 만들어도 결과가 앱으로 오지 않는다.
 * 그래서 예전에는 이 화면의 버튼이 "아직 안 됩니다" 만 말했다.
 *
 * <p>백엔드를 고치는 대신 <b>웹을 거쳐 돌아온다</b>. 백엔드 배포가 수동 jar 교체라 대기 중이고,
 * 웹은 배포가 바로 되기 때문이다. 흐름은 이렇다:
 *
 * <pre>
 *   앱  → popspot.co.kr/oauth/start/kakao   (쿠키 하나 심고 백엔드로 302)
 *       → 카카오 로그인
 *       → 백엔드 → popspot.co.kr/oauth/callback?code=…
 *       → 그 페이지가 쿠키를 보고 popspot://auth?code=… 로 <b>앱을 깨운다</b>
 *   앱  → POST /api/v1/auth/oauth/exchange {code} → 토큰
 * </pre>
 *
 * <p>웹 콜백은 앱에서 온 흐름이면 <b>교환하지 않는다.</b> 교환 코드는 1회성이라(Redis 60초) 브라우저가
 * 먼저 쓰면 앱은 아무것도 못 받는다.
 *
 * <h3>알아 둘 위험</h3>
 *
 * <p>{@code popspot://} 는 <b>커스텀 스킴</b>이다. 안드로이드에서는 다른 앱도 같은 스킴을 등록할 수
 * 있어서, 악성 앱이 깔려 있으면 교환 코드를 가로챌 수 있다(코드는 60초·1회용이지만 그 안에 쓰면
 * 그 계정으로 로그인된다). 막는 방법은 <b>App Links</b> 다 — {@code https://popspot.co.kr/…} 를
 * {@code .well-known/assetlinks.json} 로 검증해 우리 앱만 받게 하는 것. 그건 서명 인증서 지문과
 * <b>새 네이티브 빌드</b>가 필요해서, 스토어 제출 전에 함께 넣는다. 지금 빌드에서 동작을 확인하는
 * 것이 먼저다.
 */

export type SocialProvider = 'kakao' | 'naver' | 'google';

/** 브라우저가 앱을 깨울 때 쓰는 주소. 웹 {@code lib/oauthAppFlow.ts} 와 같은 값이어야 한다. */
export const AUTH_DEEP_LINK_PREFIX = 'popspot://auth';

/** 딥링크에서 읽어 낸 것. 코드가 오거나, 실패 사유가 오거나, 우리 주소가 아니거나. */
export type AuthDeepLink =
  | { kind: 'code'; code: string; nonce: string | null }
  | { kind: 'error'; reason: string; nonce: string | null }
  | null;

/**
 * 이 로그인 시도를 가리키는 1회용 값.
 *
 * <p><b>이게 없으면 로그인 CSRF 가 된다.</b> 안드로이드의 커스텀 스킴은 독점이 아니라서, 누가
 * {@code popspot://auth?code=<공격자 코드>} 링크 하나를 열게 만들면 앱은 그것을 자기 로그인으로
 * 착각하고 <b>공격자 계정에 로그인</b>된다. 그 뒤 사용자가 넣는 정보는 전부 공격자 계정에 쌓인다.
 * 웹 콜백 페이지가 {@code ?token=} 경로를 지운 것과 같은 위협이다.
 *
 * <p>그래서 앱이 값을 만들어 시작 주소에 싣고, 웹이 그것을 쿠키에 담았다가 돌아올 때 되돌려 주고,
 * 앱이 <b>자기가 만든 것과 같은지</b> 본다. 남이 만든 딥링크에는 이 값이 들어 있을 수 없다.
 *
 * <p><b>암호학적으로 강한 난수는 아니다.</b> {@code expo-crypto} 는 새 네이티브 모듈이라 지금
 * 빌드에 없다. 다만 이 값은 비밀이 아니라 <b>짝 맞추기</b>용이고, 공격자가 그것을 볼 방법이 없다
 * (기기 밖으로 나가는 것은 TLS 안의 우리 도메인뿐이다). 진짜 해법은 커스텀 스킴을 버리고
 * <b>App Links</b> 로 가는 것이고, 그건 새 빌드가 필요해 스토어 제출 때 함께 넣는다.
 */
export function newNonce(): string {
  const part = () => Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}${part()}${part()}`.slice(0, 40);
}

/**
 * 저장한 난수가 이보다 오래되면 버린다.
 *
 * <p>카카오에서 비밀번호를 찾거나 문자 인증을 하는 시간까지 덮어야 한다 — 짧게 잡으면 그 사람의
 * 로그인이 마지막 단계에서 조용히 버려진다.
 */
const PENDING_NONCE_TTL_MS = 30 * 60 * 1000;

/**
 * 진행 중인 난수를 <b>저장소에도</b> 둔다.
 *
 * <p>메모리에만 두면 브라우저에 다녀오는 동안 안드로이드가 앱을 죽였을 때 값이 사라진다. 그때
 * "확인할 것이 없으니 통과" 로 두면 그 창이 곧 공격면이 되고, "확인 못 하니 버림" 으로 두면
 * 저사양 기기에서 로그인이 아예 안 된다. 저장해 두면 둘 다 피한다.
 *
 * <p>{@code SecureStore} 를 쓰는 것은 비밀이라서가 아니라 <b>토큰과 같은 곳</b>에 두기 위해서다 —
 * 로그아웃이 저장소를 비울 때 이것만 남는 일이 없다.
 */
export async function writePendingNonce(nonce: string): Promise<void> {
  await setPendingNonce(JSON.stringify({ nonce, at: Date.now() }));
}

export async function clearPendingNonce(): Promise<void> {
  await setPendingNonce(null);
}

/** 저장된 난수. 없거나 오래됐으면 null — 그때는 어떤 코드도 받지 않는다. */
export async function readPendingNonce(): Promise<string | null> {
  const raw = await getPendingNonce();
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { nonce?: unknown; at?: unknown };
    if (typeof saved.nonce !== 'string' || typeof saved.at !== 'number') return null;
    if (Date.now() - saved.at > PENDING_NONCE_TTL_MS) return null;
    return saved.nonce;
  } catch {
    return null;
  }
}

/**
 * {@code popspot://auth?…} 에서 코드나 오류를 꺼낸다.
 *
 * <p>앱은 이 스킴으로 다른 딥링크도 받을 수 있으므로(나중에 팝업 공유 링크 등), <b>우리 주소가
 * 아니면 null</b> 을 돌려주고 부르는 쪽이 무시하게 한다.
 *
 * <p>{@code URL} 로 파싱하지 않고 문자열을 직접 다룬다 — Hermes 의 {@code URL} 은 커스텀 스킴의
 * 쿼리를 제대로 안 주는 경우가 있고({@code react-native-url-polyfill} 을 깔아 두었지만 스킴별
 * 동작까지 보장되지는 않는다), 여기서 틀리면 로그인이 통째로 안 된다.
 */
export function parseAuthDeepLink(url: string): AuthDeepLink {
  if (!url || !url.startsWith(AUTH_DEEP_LINK_PREFIX)) return null;

  const queryStart = url.indexOf('?');
  if (queryStart < 0) return { kind: 'error', reason: 'no_code', nonce: null };

  const params = new Map<string, string>();
  for (const pair of url.slice(queryStart + 1).split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq < 0 ? pair : pair.slice(0, eq);
    const value = eq < 0 ? '' : pair.slice(eq + 1);
    try {
      params.set(decodeURIComponent(key), decodeURIComponent(value));
    } catch {
      /* 잘못 인코딩된 값 하나 때문에 로그인 전체를 버리지 않는다. */
      params.set(key, value);
    }
  }

  const nonce = params.get('n') || null;
  const code = params.get('code');
  if (code) return { kind: 'code', code, nonce };
  return { kind: 'error', reason: params.get('error') || 'no_code', nonce };
}

/** 실패 사유를 사람이 읽는 문장으로. 서버가 주는 값은 짧은 코드다. */
export function socialErrorMessage(reason: string): string {
  switch (reason) {
    case 'no_email':
      /* 카카오는 이메일 제공에 동의하지 않으면 이메일을 안 준다. 우리는 이메일로 계정을 찾으므로
         그 경우 로그인할 수 없다 — 무엇을 해야 하는지 말해 준다. */
      return '이메일 제공에 동의해야 로그인할 수 있어요. 다시 시도할 때 이메일 항목을 체크해 주세요.';
    case 'inactive':
      return '정지되었거나 탈퇴한 계정이에요.';
    case 'denied':
      /* 사용자가 동의 화면에서 취소했거나 제공자 쪽에서 실패했다. 백엔드는 이 경우 콜백이 아니라
         웹 로그인 페이지로 보내는데, 그 페이지가 앱 표시를 보고 이 사유로 되돌려 준다. */
      return '로그인을 취소했어요.';
    case 'no_code':
      return '로그인을 끝내지 못했어요. 다시 시도해 주세요.';
    default:
      return `로그인하지 못했어요. (${reason})`;
  }
}

/** 브라우저를 열 주소. 백엔드 주소를 앱에 박지 않으려고 웹을 한 번 거친다. */
export function socialLoginUrl(provider: SocialProvider, nonce: string): string {
  return `${WEB_BASE_URL}/oauth/start/${provider}?n=${encodeURIComponent(nonce)}`;
}

/**
 * 브라우저를 연다.
 *
 * <p>{@code expo-web-browser} 를 쓰지 않는 이유는 그것이 <b>새 네이티브 모듈</b>이기 때문이다 —
 * 넣으면 스토어 빌드를 다시 만들어야 한다. {@code Linking} 은 코어라 지금 깔린 빌드에서 그대로
 * 돈다. 대신 시스템 브라우저로 나갔다 오므로 앱이 잠깐 뒤로 밀린다.
 */
export async function startSocialLogin(provider: SocialProvider, nonce: string): Promise<boolean> {
  try {
    await Linking.openURL(socialLoginUrl(provider, nonce));
    return true;
  } catch {
    return false;
  }
}

/** 교환 응답. 웹 콜백이 받는 것과 같은 모양이다. */
interface ExchangeResponse {
  token?: string;
  refreshToken?: string;
  totpRequired?: string | boolean;
  challengeToken?: string;
}

/**
 * 1회성 코드를 토큰으로 바꾸고 저장한다.
 *
 * <p>교환 응답에는 <b>프로필이 없다</b>(토큰 둘뿐). 이메일 로그인은 응답에 프로필이 함께 와서
 * 그대로 저장하는데, 이쪽은 {@code /me} 를 한 번 더 불러야 한다 — 안 부르면 {@code userId} 가 없어
 * 찜·스탬프가 통째로 안 된다.
 */
export async function exchangeSocialCode(code: string): Promise<AuthResult> {
  let body: ExchangeResponse;
  try {
    /* 저장된 토큰을 <b>붙이지 않는다</b>. 백엔드 {@code JwtAuthenticationFilter} 는
       {@code Authorization} 헤더가 있는데 그 토큰이 만료·무효면 <b>공개 경로라도</b> 컨트롤러에
       닿기 전에 401 을 쏜다. 예전에 로그인했다가 토큰이 만료된 기기에서는 교환이 매번 401 이고,
       다시 눌러도 같은 토큰이 다시 붙어 영영 안 풀린다 — 화면에는 "코드가 만료되었다" 로 보인다. */
    const res = await apiFetch(
      '/api/v1/auth/oauth/exchange',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      },
      { anonymous: true },
    );
    if (!res.ok) {
      /* 만료·재사용은 401 이다. 그 경우 "다시 해 보세요" 가 정확한 안내다 — 코드는 60초짜리다. */
      if (res.status === 401 || res.status === 400) {
        return { kind: 'error', message: '로그인 시간이 지났어요. 다시 시도해 주세요.' };
      }
      return { kind: 'error', message: `로그인하지 못했어요. (${res.status})` };
    }
    body = (await res.json()) as ExchangeResponse;
  } catch {
    /* 요청이 백엔드에 닿았다면 코드는 이미 소비됐다(Redis GET+DEL 한 덩어리). 같은 코드로는
       절대 다시 안 되므로 '잠시 후 다시' 라고 말하면 안 된다 — 처음부터 다시 돌아야 한다. */
    return { kind: 'error', message: '연결이 끊겨 로그인을 마치지 못했어요. 다시 로그인해 주세요.' };
  }

  /* 2단계 인증이 켜진 계정이면 토큰이 오지 않는다. 이메일 로그인과 <b>같은</b> 6자리 화면으로
     이어간다 — 경로가 갈리면 한쪽만 고치는 사고가 난다. */
  if (body.totpRequired && body.challengeToken) {
    return { kind: 'totp', challengeToken: body.challengeToken };
  }
  if (!body.token) return { kind: 'error', message: '로그인 응답에 토큰이 없습니다.' };

  await setAuthToken(body.token);
  await setRefreshToken(body.refreshToken ?? null);

  /* 프로필을 못 받아도 토큰은 이미 저장했다 — 로그인 자체는 된 것이므로 되돌리지 않는다.
     userId 가 없으면 찜·스탬프만 안 되고, 다음에 앱을 켤 때 다시 시도된다. */
  try {
    const me = await apiFetch('/api/v1/auth/me');
    if (me.ok) {
      const user = (await me.json()) as User;
      await setStoredUser(user);
      return { kind: 'ok', user };
    }
  } catch {
    /* 아래 폴백으로 간다. */
  }
  return { kind: 'ok', user: {} as User };
}
