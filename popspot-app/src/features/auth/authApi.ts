import { apiFetch } from '@/lib/api';
import { clearAuthToken, setAuthToken, setRefreshToken, setStoredUser } from '@/lib/authStorage';
import { fetchPolicyVersions } from '@/lib/policyVersions';
import type { User } from '@/types/popup';

/**
 * 로그인·회원가입 — 웹 {@code app/login/page.tsx} 가 부르는 것과 <b>같은 엔드포인트</b>.
 *
 * <p>앱 전용 인증 경로를 새로 만들지 않는다. 같은 계정으로 웹과 앱을 오갈 수 있어야 하고,
 * 서버가 이미 이 셋을 갖고 있다({@code /api/v1/auth/login}, {@code .../login/totp},
 * {@code /api/v1/auth/signup}).
 */

/** 로그인 성공. 토큰과 프로필이 함께 온다. */
export interface AuthSuccess {
  kind: 'ok';
  user: User;
}

/**
 * 2단계 인증이 남았다.
 *
 * <p>이 경우 <b>토큰이 오지 않는다.</b> 성공과 같은 모양으로 뭉뚱그리면 화면이 토큰 없는 상태로
 * 로그인된 줄 알고 넘어간다 — 그래서 종류를 나눠 돌려준다.
 */
export interface AuthTotp {
  kind: 'totp';
  challengeToken: string;
}

export interface AuthFailure {
  kind: 'error';
  message: string;
}

export type AuthResult = AuthSuccess | AuthTotp | AuthFailure;

/** 서버가 주는 로그인 응답. 토큰 두 개와 나머지 프로필. */
interface LoginResponse {
  token?: string;
  refreshToken?: string;
  totpRequired?: boolean;
  challengeToken?: string;
  [key: string]: unknown;
}

/** 토큰을 저장하고 프로필만 남긴다. */
async function accept(data: LoginResponse): Promise<AuthResult> {
  if (data.totpRequired && data.challengeToken) {
    return { kind: 'totp', challengeToken: data.challengeToken };
  }
  if (!data.token) return { kind: 'error', message: '로그인 응답에 토큰이 없습니다.' };

  await setAuthToken(data.token);
  await setRefreshToken(data.refreshToken ?? null);

  const { token: _t, refreshToken: _r, ...rest } = data;
  const user = rest as unknown as User;
  /* 찜·스탬프 API 가 userId 를 쿼리로 받는다. 여기서 저장해 두지 않으면 앱을 다시 켤 때 알 수 없다. */
  await setStoredUser(user);
  return { kind: 'ok', user };
}

/**
 * 서버가 준 오류 문구를 그대로 보여준다.
 *
 * <p>"로그인에 실패했습니다" 로 뭉개지 않는다 — 서버는 "가입되지 않은 이메일" 과 "비밀번호가
 * 다릅니다" 를 구분해 주는데, 화면에서 합치면 사용자가 무엇을 고쳐야 할지 모른다.
 */
async function reason(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  if (!body) return `로그인하지 못했습니다. (${res.status})`;
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? body;
  } catch {
    return body;
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { kind: 'error', message: await reason(res) };
    return accept((await res.json()) as LoginResponse);
  } catch {
    return { kind: 'error', message: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }
}

/** 2단계 인증 6자리. */
export async function verifyTotp(challengeToken: string, code: string): Promise<AuthResult> {
  try {
    const res = await apiFetch('/api/v1/auth/login/totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken, code }),
    });
    if (!res.ok) return { kind: 'error', message: await reason(res) };
    return accept((await res.json()) as LoginResponse);
  } catch {
    return { kind: 'error', message: '서버에 연결하지 못했습니다.' };
  }
}

export interface SignupPayload {
  email: string;
  password: string;
  nickname: string;
  phoneNumber: string;
}

/**
 * 가입.
 *
 * <p><b>약관 버전을 서버에서 받아 그대로 되돌려 보낸다.</b> 처음에는 이 자리에 이메일·비밀번호·
 * 닉네임·전화번호만 실어 보냈는데, 서버는 그것만으로 가입시켜 주지 않는다 — 동의 여부와 <b>동의한
 * 정책의 버전</b>을 함께 받아야 한다({@code age14OrOlder}, {@code termsAccepted},
 * {@code privacyAccepted}, {@code termsVersion}, {@code privacyVersion}).
 *
 * <p>버전을 앱에 상수로 박으면 안 된다. 웹이 그렇게 했다가 백엔드 env 와 어긋나는 순간
 * <b>신규 가입이 전부 실패</b>했고, 그때 뜨는 문구가 "정책이 변경되었습니다" 라 원인을 찾기도
 * 어려웠다({@code lib/policyVersions.ts} 주석). 서버가 "지금 이게 최신" 이라고 알려 준 값을 그대로
 * 되돌려 보낸다.
 *
 * <p>버전을 못 받으면 <b>가입을 시도하지 않는다.</b> 빈 문자열로 보내면 서버가 거절하는데, 그
 * 거절은 "약관이 바뀌었다" 로 보여서 사용자가 할 수 있는 일이 없다.
 */
export async function signup(payload: SignupPayload): Promise<AuthResult> {
  const versions = await fetchPolicyVersions();
  if (!versions) {
    return { kind: 'error', message: '약관 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  try {
    const res = await apiFetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        age14OrOlder: true,
        termsAccepted: true,
        privacyAccepted: true,
        ...versions,
      }),
    });
    if (!res.ok) return { kind: 'error', message: await reason(res) };
    return accept((await res.json()) as LoginResponse);
  } catch {
    return { kind: 'error', message: '서버에 연결하지 못했습니다.' };
  }
}

/**
 * 이메일 인증코드 보내기 — 가입과 비밀번호 재설정이 서로 다른 문을 쓴다.
 *
 * <p>가입은 {@code /email/send}({@code email} 만), 비밀번호 재설정은 {@code /email/send-for-pw}
 * ({@code email} + {@code nickname})다. 재설정 쪽이 닉네임을 함께 받는 이유는 <b>남의 이메일로
 * 재설정 코드를 보내는 것</b>을 막기 위해서다.
 */
export async function sendSignupCode(email: string): Promise<string | null> {
  try {
    const res = await apiFetch('/api/v1/auth/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.ok ? null : await reason(res);
  } catch {
    return '서버에 연결하지 못했습니다.';
  }
}

/** 인증코드 확인. {@code purpose} 로 가입과 재설정을 가른다 — 코드가 서로 통용되면 안 된다. */
export async function verifyEmailCode(
  email: string,
  code: string,
  purpose: 'SIGNUP' | 'PASSWORD_RESET',
): Promise<string | null> {
  try {
    const res = await apiFetch('/api/v1/auth/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, purpose }),
    });
    return res.ok ? null : '인증번호가 맞지 않습니다.';
  } catch {
    return '서버에 연결하지 못했습니다.';
  }
}

export async function logout(): Promise<void> {
  await clearAuthToken();
}
