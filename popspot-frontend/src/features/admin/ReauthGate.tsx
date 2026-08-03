// 'use client' 를 붙이지 않는다 — 관리자 화면(이미 'use client')에서만 쓰이고, 붙이면 이 파일이
// 클라이언트 경계의 진입점이 되어 onClose·onConfirmed 같은 콜백을 받을 수 없다.

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import { apiFetch } from '@/lib/api';

/**
 * 되돌릴 수 없는 작업이 막혔을 때 뜨는 확인 창.
 *
 * <p>서버가 <b>428</b>로 답하면 이 창을 띄운다. 403 이 아닌 이유는, 403 은 "권한이 없다" 라서 화면이 재로그인을 유도하는데 여기서 필요한 것은 로그인이
 * 아니라 확인 한 번이기 때문이다. 상태코드가 다르니 화면도 다르게 반응할 수 있다.
 *
 * <p>무엇을 물을지는 <b>서버가 정한다</b>. 소셜 계정에는 비밀번호가 아예 없어서, 화면이 임의로 고르면 있지도 않은 값을 묻는 사고가 난다.
 */

type Method = 'TOTP' | 'PASSWORD' | 'NONE';

export function ReauthGate({
  open,
  onClose,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  /** 확인 성공 — 막혔던 작업을 다시 시도하면 된다. */
  onConfirmed: () => void;
}) {
  const [method, setMethod] = useState<Method>('TOTP');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMethod = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/reauth/status');
      if (!res.ok) return;
      const data = (await res.json()) as { method: Method };
      setMethod(data.method);
    } catch {
      /* 못 읽어도 기본값(6자리)으로 뜬다 */
    }
  }, []);

  useEffect(() => {
    if (open) loadMethod();
  }, [open, loadMethod]);

  if (!open) return null;

  const isTotp = method === 'TOTP';

  const submit = async () => {
    const value = secret.trim();
    if (busy || !value) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/reauth', {
        method: 'POST',
        body: JSON.stringify({ secret: value }),
      });
      if (!res.ok) {
        setError(isTotp ? '코드가 맞지 않습니다.' : '비밀번호가 맞지 않습니다.');
        return;
      }
      setSecret('');
      onConfirmed();
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="본인 확인"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--color-border)] bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500" aria-hidden />
          <h2 className="text-base font-bold">본인 확인</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          되돌릴 수 없는 작업입니다.{' '}
          {isTotp ? '인증 앱의 6자리를 입력하세요.' : '비밀번호를 입력하세요.'}
          <br />한 번 확인하면 10분 동안 다시 묻지 않습니다.
        </p>

        <input
          value={secret}
          onChange={(e) => {
            setSecret(isTotp ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          type={isTotp ? 'text' : 'password'}
          inputMode={isTotp ? 'numeric' : 'text'}
          placeholder={isTotp ? '000000' : '비밀번호'}
          autoComplete={isTotp ? 'one-time-code' : 'current-password'}
          autoFocus
          className="w-full rounded-xl border border-[var(--color-border)] bg-surface-2 px-4 py-3 text-center font-mono tracking-widest"
        />

        {error && (
          <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-bold text-muted-foreground"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !secret.trim()}
            className="flex-1 rounded-xl bg-foreground py-2.5 text-sm font-bold text-[var(--color-surface)] disabled:opacity-40"
          >
            {busy ? '확인 중…' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
