import { apiFetch } from '@/lib/api';

/**
 * 아이디 찾기 · 비밀번호 재설정 — 웹 {@code app/find-account/page.tsx} 가 부르는 것과 같은 문 넷.
 *
 * <p>{@code /find-email} · {@code /email/send-for-pw} · {@code /email/verify} ·
 * {@code /reset-password}. 앱 전용 경로를 만들지 않는다 — 계정 하나를 웹과 앱이 함께 쓰는데
 * 복구 경로가 둘이면, 한쪽만 고쳐졌을 때 복구가 안 되는 계정이 생긴다.
 */

/** 아이디 찾기 결과. */
export interface FoundAccount {
  email: string;
  /**
   * 소셜 가입이면 어디로 가입했는지({@code GOOGLE}·{@code KAKAO}·{@code NAVER}).
   *
   * <p><b>이걸 안 보여주면 사람이 막힌다.</b> 소셜로 가입한 계정은 비밀번호가 없어서, 이메일만
   * 알려 주면 비밀번호 찾기로 갔다가 또 막힌다. 어느 문으로 들어가야 하는지 함께 말해 준다.
   */
  provider: string | null;
}

export type FindResult =
  | { kind: 'ok'; account: FoundAccount }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string };

export async function findEmail(nickname: string, phoneNumber: string): Promise<FindResult> {
  try {
    const query = `nickname=${encodeURIComponent(nickname)}&phoneNumber=${encodeURIComponent(phoneNumber)}`;
    const res = await apiFetch(`/api/v1/auth/find-email?${query}`);

    /* 404 는 "그런 계정이 없다" 는 사실이지 오류가 아니다. 오류로 다루면 화면이 "다시 시도해
       주세요" 라고 말하는데, 다시 시도해도 결과는 같다. */
    if (res.status === 404) return { kind: 'notFound' };
    if (!res.ok) return { kind: 'error', message: '계정을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.' };

    const data = (await res.json()) as { email?: string; provider?: string };
    if (!data.email) return { kind: 'notFound' };

    return {
      kind: 'ok',
      account: {
        email: data.email,
        provider: data.provider && data.provider !== 'LOCAL' ? data.provider : null,
      },
    };
  } catch {
    return { kind: 'error', message: '서버에 연결하지 못했습니다.' };
  }
}

/**
 * 재설정 코드 보내기.
 *
 * <p>서버가 소셜 계정에는 {@code SOCIAL_USER:google} 같은 본문으로 거절한다. 그 문자열을 그대로
 * 보여주면 사람이 읽을 수 없으니 어느 소셜인지만 뽑아 말한다.
 */
export async function sendResetCode(email: string, nickname: string): Promise<string | null> {
  try {
    const res = await apiFetch('/api/v1/auth/email/send-for-pw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nickname }),
    });
    if (res.ok) return null;

    const body = await res.text().catch(() => '');
    if (body.includes('SOCIAL_USER')) {
      const provider = (body.split(':')[1] ?? '').trim().toUpperCase();
      return `${provider || '소셜'} 계정으로 가입하셨어요. 비밀번호 대신 그 계정으로 로그인해 주세요.`;
    }
    return body || '인증번호를 보내지 못했습니다.';
  } catch {
    return '서버에 연결하지 못했습니다.';
  }
}

export async function resetPassword(email: string, newPassword: string): Promise<string | null> {
  try {
    const res = await apiFetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword }),
    });
    return res.ok ? null : (await res.text().catch(() => '')) || '비밀번호를 바꾸지 못했습니다.';
  } catch {
    return '서버에 연결하지 못했습니다.';
  }
}
