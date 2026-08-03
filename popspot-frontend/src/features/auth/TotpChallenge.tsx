// 'use client' 를 붙이지 않는다.
//
// 붙이면 이 파일이 클라이언트 경계의 <b>진입점</b>이 되고, 그러면 넘어오는 props 가 직렬화 가능해야
// 해서 onSuccess 같은 콜백을 받을 수 없다. 이 컴포넌트는 로그인 화면·소셜 콜백(둘 다 이미
// 'use client')에서만 쓰이므로 그쪽의 클라이언트 경계를 그대로 물려받는 것이 맞다.

import { useState } from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { setAuthToken, setRefreshToken } from '@/lib/authStorage';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';

/**
 * 로그인 2단계 — 인증 앱의 6자리 또는 복구 코드.
 *
 * <p><b>이메일 로그인과 소셜 로그인이 이 화면을 함께 쓴다.</b> 따로 만들면 한쪽만 고치는 사고가 난다 —
 * 실제로 백엔드에서 이메일 경로만 막았다가 소셜이 통째로 우회하는 것을 뒤늦게 발견했다.
 *
 * <p>표는 한 번 쓰면 사라진다. 코드를 틀리면 다시 로그인부터 해야 한다 — 같은 표로 6자리를 계속
 * 대입하지 못하게 하기 위해서다. 화면도 그렇게 안내한다.
 *
 * <p>색은 로그인 카드(ink/cream/lime)를 그대로 따른다. 두 화면 모두 테마와 무관하게 어두운 바탕이라
 * 테마 토큰(bg-surface 등)을 쓰면 밝은 테마에서 흰 상자가 떠 버린다.
 */
export function TotpChallenge({
  challengeToken,
  onSuccess,
}: {
  challengeToken: string;
  /** 로그인 완료 — 프로필을 받아 화면을 이동시킨다. */
  onSuccess: (profile: Record<string, unknown>) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  /** 표를 이미 써 버렸다 — 다시 시도하려면 로그인부터. */
  const [spent, setSpent] = useState(false);

  const submit = async () => {
    const value = code.trim();
    if (busy || spent || !value) return;

    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/auth/login/totp', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code: value }),
      });

      if (!res.ok) {
        // 표는 서버에서 이미 사라졌다. 재입력을 시켜 봐야 무조건 실패한다.
        setSpent(true);
        setError((await res.text()) || '코드가 맞지 않습니다.');
        return;
      }
      const data = await res.json();
      const { token, refreshToken, ...profile } = data;
      // 토큰은 sessionStorage 로만 — 로그인 화면과 같은 규칙이다.
      if (token) setAuthToken(token);
      if (refreshToken) setRefreshToken(refreshToken);
      onSuccess(profile);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 text-cream-200">
        <ShieldCheck className="size-5 text-lime-300" aria-hidden />
        <h2 className="text-base font-bold">2단계 인증</h2>
      </div>

      <p className="text-center text-sm text-cream-200/60">
        {useRecovery
          ? '저장해 둔 복구 코드 하나를 입력하세요. 한 번 쓰면 사라집니다.'
          : '인증 앱에 표시된 6자리를 입력하세요.'}
      </p>

      <Field
        label={<span className="text-cream-200">{useRecovery ? '복구 코드' : '인증 코드'}</span>}
      >
        <Input
          value={code}
          onChange={(e) => {
            // 인증 앱 코드는 숫자만, 복구 코드는 영문·하이픈이 섞인다.
            setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
          inputMode={useRecovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoFocus
          disabled={spent}
          iconLeft={<KeyRound className="size-4" aria-hidden />}
          className="bg-ink-900/60 border-cream-200/15 text-cream-200 placeholder:text-cream-200/30 text-center font-mono tracking-[0.3em]"
        />
      </Field>

      {error && (
        <p role="alert" className="text-center text-sm text-red-300">
          {error}
          {spent && (
            <>
              <br />
              <span className="text-cream-200/60">보안을 위해 처음부터 다시 로그인해 주세요.</span>
            </>
          )}
        </p>
      )}

      {spent ? (
        <Button variant="primary" size="lg" block onClick={() => window.location.reload()}>
          다시 로그인
        </Button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          block
          onClick={submit}
          loading={busy}
          disabled={!code.trim()}
        >
          확인
        </Button>
      )}

      {!spent && (
        <button
          type="button"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode('');
            setError(null);
          }}
          className="w-full text-center text-xs text-cream-200/60 underline transition-colors hover:text-cream-200"
        >
          {useRecovery ? '인증 앱 코드로 입력' : '인증 앱을 쓸 수 없나요? 복구 코드 사용'}
        </button>
      )}
    </div>
  );
}
