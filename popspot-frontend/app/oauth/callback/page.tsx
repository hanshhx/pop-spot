'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../../src/lib/api';
import { setAuthToken } from '../../../src/lib/authStorage';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { TotpChallenge } from '@/features/auth/TotpChallenge';

const COPY = {
  ko: {
    processing: '로그인 처리 중...',
    expired: '로그인 교환 코드가 만료되었거나 이미 사용되었습니다.',
    noToken: '로그인 토큰을 받지 못했습니다.',
    saving: '인증 정보 저장 중...',
    missing: '인증 토큰을 찾을 수 없습니다.',
    success: '로그인 성공! 메인으로 이동합니다.',
    denied: (status: number) => `인증이 거부되었습니다 (${status}).`,
    network: '서버에 연결하지 못했습니다.',
    fallback: '인증 정보를 확인 중입니다...',
  },
  en: {
    processing: 'Signing you in…',
    expired: 'This sign-in code has expired or has already been used.',
    noToken: 'The server did not return a login token.',
    saving: 'Saving your sign-in…',
    missing: 'No sign-in code was found.',
    success: 'Signed in. Taking you to POP-SPOT…',
    denied: (status: number) => `Sign-in was denied (${status}).`,
    network: 'Could not connect to the server.',
    fallback: 'Checking your sign-in…',
  },
  ja: {
    processing: 'ログイン処理中…',
    expired: 'ログインコードの期限が切れているか、すでに使用されています。',
    noToken: 'ログイン情報を受け取れませんでした。',
    saving: 'ログイン情報を保存中…',
    missing: 'ログインコードが見つかりません。',
    success: 'ログインしました。メイン画面へ移動します…',
    denied: (status: number) => `ログインが拒否されました（${status}）。`,
    network: 'サーバーに接続できませんでした。',
    fallback: 'ログイン情報を確認中…',
  },
} as const;

// OAuth 콜백 페이지의 자동 리다이렉트 타이밍.
// 짧으면 사용자가 메시지를 못 읽고, 길면 답답함. UX 테스트로 잡은 값.
const AUTH_SUCCESS_REDIRECT_MS = 500;
const AUTH_ERROR_REDIRECT_MS = 2000;
const AUTH_FAILURE_REDIRECT_MS = 3000;

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [status, setStatus] = useState<string>(copy.processing);
  const hasFetched = useRef(false); // React StrictMode 이중 호출 방지용
  /** 2단계 인증이 남았을 때 받은 단기 표. */
  const [totpChallenge, setTotpChallenge] = useState<string | null>(null);

  useEffect(() => {
    // 이미 한 번 요청을 보냈다면 중복 실행 방지
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchUserInfo = async () => {
      try {
        // 백엔드(OAuth2SuccessHandler)는 1회성 교환코드만 붙여 보낸다 — ?code= 하나뿐이다.
        //
        // v2.40 배포 시차 동안에는 구버전이 URL 로 JWT 를 직접 실어 주는 ?token= 도 받아 줬는데,
        // 배포가 끝난 뒤에도 남아 있었다. 이 경로는 URL 로 온 토큰을 <b>검증 없이 그대로 저장</b>하므로,
        // 공격자가 자기 토큰을 담은 링크를 보내면 피해자가 공격자 계정으로 로그인된다(로그인 CSRF).
        // 그 상태로 입력한 정보는 공격자 계정에 쌓인다. 쓰이지 않으면서 위험만 남는 경로라 제거했다.
        const exchangeCode = searchParams.get('code');

        if (exchangeCode) {
          // 신규(보안) 흐름: 1회성 교환코드를 서버에서 토큰으로 교환.
          // 보안: 코드를 URL/히스토리에서 즉시 제거 (프록시 로그·뒤로가기 노출 최소화).
          window.history.replaceState({}, '', localizedPath('/oauth/callback', locale));
          const exchangeResponse = await apiFetch('/api/v1/auth/oauth/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: exchangeCode }),
          });
          if (!exchangeResponse.ok) {
            throw new Error(copy.expired);
          }
          const exchangeBody = (await exchangeResponse.json()) as {
            token?: string;
            totpRequired?: string | boolean;
            challengeToken?: string;
          };

          // 2단계 인증이 남았으면 토큰이 오지 않는다. 이메일 로그인과 <b>같은</b> 6자리 화면으로
          // 이어간다 — 경로가 갈리면 한쪽만 고치는 사고가 난다.
          if (exchangeBody.totpRequired && exchangeBody.challengeToken) {
            setTotpChallenge(exchangeBody.challengeToken);
            return;
          }
          if (!exchangeBody.token) throw new Error(copy.noToken);
          setAuthToken(exchangeBody.token);
          setStatus(copy.saving);
        } else {
          // 교환코드가 없으면 정상 진입이 아니다.
          setStatus(copy.missing);
          setTimeout(() => router.push(localizedPath('/login', locale)), AUTH_ERROR_REDIRECT_MS);
          return;
        }

        const res = await apiFetch('/api/v1/auth/me', {
          method: 'GET',
        });

        if (res.ok) {
          // 서버가 토큰을 검증하고 유저 정보를 반환합니다.
          const userInfo = await res.json();

          // 4. 유저 정보를 로컬 스토리지에 세팅
          const realUser = {
            userId: userInfo.userId,
            nickname: userInfo.nickname,
            isPremium: userInfo.isPremium,
            role: userInfo.role,
            isSocial: true,
          };
          localStorage.setItem('user', JSON.stringify(realUser));

          // 5. 로그인 성공 처리 (인트로 미들웨어 우회 — 메인 직행)
          setStatus(copy.success);
          setTimeout(() => {
            window.location.href = localizedPath('/?entered=1', locale);
          }, AUTH_SUCCESS_REDIRECT_MS);
        } else {
          // 백엔드가 401 에러 등을 보내면, 에러 메시지를 까서 보여줍니다.
          setStatus(copy.denied(res.status));
          setTimeout(() => router.push(localizedPath('/login', locale)), AUTH_FAILURE_REDIRECT_MS);
        }
      } catch (error) {
        console.error('Fetch API 에러:', error);
        setStatus(error instanceof Error && error.message ? error.message : copy.network);
        setTimeout(() => router.push(localizedPath('/login', locale)), AUTH_FAILURE_REDIRECT_MS);
      }
    };

    fetchUserInfo();
  }, [router, searchParams, locale, copy]);

  // 2단계 인증 — 이메일 로그인과 <b>같은</b> 화면을 쓴다.
  if (totpChallenge) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-cream-200/10 bg-ink-800/80 p-6 backdrop-blur-xl">
        <TotpChallenge
          challengeToken={totpChallenge}
          onSuccess={(profile) => {
            // 아래 정상 경로가 저장하는 모양을 그대로 맞춘다. 응답을 통째로 넣으면 email 같은
            // 값이 localStorage 에 새로 남는다 — 2단계 인증 여부에 따라 저장 내용이 달라지면 안 된다.
            localStorage.setItem(
              'user',
              JSON.stringify({
                userId: profile.userId,
                nickname: profile.nickname,
                isPremium: profile.isPremium,
                role: profile.role,
                isSocial: true,
              }),
            );
            window.location.href = localizedPath('/?entered=1', locale);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 md:gap-4 px-4 text-center">
      <Loader2 className="w-8 h-8 md:w-12 md:h-12 text-lime-500 animate-spin" />
      <h2 className="text-lg md:text-xl font-bold text-white">{status}</h2>
    </div>
  );
}

export default function OAuthCallbackPage() {
  const { locale } = useLocale();
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {/* [구조 해석] useSearchParams를 사용하기 위해 Suspense로 감싸는 기존 구조를 유지합니다. */}
      <Suspense
        fallback={
          <div className="text-white text-sm md:text-base font-medium">{COPY[locale].fallback}</div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
