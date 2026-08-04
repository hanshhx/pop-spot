'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Copy, Check } from 'lucide-react';
import qrcode from 'qrcode-generator';

import { apiFetch } from '@/lib/api';
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify';

/**
 * 관리자 2단계 인증 등록 화면.
 *
 * <p>QR 은 <b>이 브라우저 안에서 그린다.</b> otpauth 주소에는 2단계 인증 비밀키가 들어 있어서, 외부
 * QR 생성 서비스에 보내면 그 비밀키를 통째로 넘기는 셈이 된다.
 *
 * <p>등록은 두 걸음이다 — QR 을 받고, 앱에 뜬 6자리를 확인한다. 확인이 끝나야 켜지고 복구 코드가
 * 나온다. 한 걸음으로 합치면 QR 만 받고 앱 등록에 실패한 사람이 잠긴다.
 */

type Status = {
  featureEnabled: boolean;
  keyReady: boolean;
  enrolled: boolean;
  recoveryRemaining: number;
};

type SetupInfo = { otpauthUri: string; manualKey: string };

/** otpauth 주소를 QR 이미지(data URI)로. 실패하면 null — 손입력 키로 안내한다. */
function toQrDataUri(text: string): string | null {
  try {
    // 타입 0 = 내용 길이에 맞춰 자동 선택. 'M' 은 표준 오류정정 수준.
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(6, 8);
  } catch {
    return null;
  }
}

export function TotpSetupPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusError(null);
    try {
      const res = await apiFetch('/api/admin/totp/status');
      // 실패를 삼키면 status 가 null 로 남는데, 아래 화면은 null 을 '미등록' 으로 그린다.
      // 이미 등록을 마친 관리자에게 "미등록" 이 뜨면 등록 버튼을 누르는 게 자연스러운
      // 반응이고, 그 순간 기존 인증기가 지워진다. 모르는 것과 없는 것은 다르다.
      if (!res.ok) {
        setStatusError('2단계 인증 상태를 읽지 못했습니다.');
        return;
      }
      setStatus(await res.json());
    } catch {
      setStatusError('서버에 연결하지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const startSetup = async () => {
    if (busy) return;

    // 상태를 모르면 물어본다. 예전엔 `status?.enrolled` 라서, 상태 조회가 실패했을 때
    // 확인창이 통째로 건너뛰어지고 곧장 등록이 시작됐다 — 읽기 실패가 파괴적 동작의
    // 유일한 가드를 없애는 구조였다.
    const mayReplace = !status || status.enrolled;
    if (mayReplace) {
      const ok = await confirmAction({
        title: status ? '다시 등록할까요?' : '이미 등록돼 있을 수 있습니다',
        text: status
          ? '지금 쓰는 인증 앱의 코드는 그 순간부터 맞지 않게 됩니다. 폰을 바꿨을 때만 쓰세요.'
          : '현재 등록 상태를 확인하지 못했습니다. 이미 등록돼 있다면 지금 쓰는 인증 앱의 코드가 맞지 않게 됩니다.',
        confirmText: '다시 등록',
        destructive: true,
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      // 기존 등록을 버리겠다는 의사를 서버에도 명시한다. 서버는 이 표시가 없으면
      // 이미 등록된 계정의 재등록을 거절한다 — 화면 한 줄이 유일한 제동장치가 아니게.
      const res = await apiFetch(`/api/admin/totp/setup?replace=${mayReplace}`, { method: 'POST' });
      if (!res.ok) {
        notifyError({ title: '등록을 시작하지 못했습니다', text: await res.text() });
        return;
      }
      setSetup(await res.json());
      setRecovery(null);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/admin/totp/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        notifyError({ title: '코드가 맞지 않습니다', text: await res.text() });
        return;
      }
      const data = (await res.json()) as { recoveryCodes: string[] };
      setRecovery(data.recoveryCodes);
      setSetup(null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const value = window.prompt('해제하려면 인증 앱의 6자리 또는 복구 코드를 입력하세요.');
    if (!value) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/admin/totp/disable', {
        method: 'POST',
        body: JSON.stringify({ code: value }),
      });
      if (!res.ok) {
        notifyError({ title: '해제하지 못했습니다', text: await res.text() });
        return;
      }
      notifySuccess('2단계 인증을 해제했습니다.');
      setRecovery(null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const copyRecovery = async () => {
    if (!recovery) return;
    await navigator.clipboard.writeText(recovery.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrUri = setup ? toQrDataUri(setup.otpauthUri) : null;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <ShieldCheck size={16} className="text-lime-500" /> 2단계 인증
      </h3>

      {/* 상태 요약 — '모름' 을 '미등록' 으로 그리지 않는다. 둘은 완전히 다른 상태다. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 font-bold ${
            !status
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/25 dark:text-amber-400'
              : status.enrolled
                ? 'bg-lime-300/20 text-lime-700 dark:text-lime-300'
                : 'bg-gray-200 text-muted-foreground dark:bg-white/10'
          }`}
        >
          {!status
            ? statusError
              ? '상태 확인 실패'
              : '확인 중…'
            : status.enrolled
              ? '등록됨'
              : '미등록'}
        </span>
        {status?.enrolled && (
          <span className="text-muted-foreground">복구 코드 {status.recoveryRemaining}개 남음</span>
        )}
        {status && !status.featureEnabled && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700 dark:bg-amber-900/25 dark:text-amber-400">
            아직 로그인에 적용되지 않음
          </span>
        )}
      </div>

      {statusError && (
        <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {statusError} 지금 등록 여부를 알 수 없으니, 새로고침해 확인한 뒤에 진행해 주세요.{' '}
          <button
            type="button"
            onClick={loadStatus}
            className="font-bold underline underline-offset-2"
          >
            다시 확인
          </button>
        </p>
      )}

      {status && !status.keyReady && (
        <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          서버에 암호화 키가 없어 등록할 수 없습니다. <code>APP_TOTP_ENCRYPTION_KEY</code> 를 설정한
          뒤 다시 시도해 주세요.
        </p>
      )}

      {status?.enrolled && status.featureEnabled === false && (
        <p className="mt-2 text-xs text-muted-foreground">
          등록은 끝났지만 서버에서 기능이 꺼져 있어 로그인 때 코드를 묻지 않습니다.{' '}
          <code>APP_TOTP_ENABLED=true</code> 로 켜세요.
        </p>
      )}

      {/* 1단계 — QR */}
      {setup && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            인증 앱(구글 OTP 등)으로 아래 QR 을 찍고, 앱에 표시된 <b>6자리</b>를 입력하세요.
          </p>
          {qrUri ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI 라 최적화 대상이 아니다
            <img
              src={qrUri}
              alt="2단계 인증 QR"
              className="rounded-xl border border-[var(--color-border)] bg-white p-2"
              width={180}
              height={180}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              QR 을 그리지 못했습니다. 아래 키를 손으로 넣으세요.
            </p>
          )}
          <div>
            <p className="text-xs text-muted-foreground">QR 을 못 찍으면 이 키를 직접 입력하세요</p>
            <code className="mt-1 block break-all rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {setup.manualKey}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6자리"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-28 rounded-lg border border-[var(--color-border)] bg-surface px-3 py-2 text-center font-mono tracking-widest"
            />
            <button
              onClick={confirm}
              disabled={busy || code.length !== 6}
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-[var(--color-surface)] disabled:opacity-40"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 2단계 — 복구 코드 (한 번만) */}
      {recovery && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
            복구 코드 — 지금 저장하세요. 다시 볼 수 없습니다.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            폰을 잃었을 때 쓰는 <b>유일한 입구</b>입니다. 비밀번호 관리자나 인쇄물로 보관하세요.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm">
            {recovery.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            onClick={copyRecovery}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사됨' : '전체 복사'}
          </button>
        </div>
      )}

      {/* 동작 버튼 */}
      {!setup && (
        <div className="mt-4 flex flex-wrap gap-2">
          {/* status 가 null 이면 `status?.keyReady === false` 가 false 라 버튼이 살아 있었다.
              옵셔널 체이닝이 '모름' 을 '정상' 으로 둔갑시키던 자리다. */}
          <button
            onClick={startSetup}
            disabled={busy || !status || status.keyReady === false}
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-[var(--color-surface)] disabled:opacity-40"
          >
            {!status ? '상태 확인 필요' : status.enrolled ? '다시 등록 (폰 교체)' : '등록 시작'}
          </button>
          {status?.enrolled && (
            <button
              onClick={disable}
              disabled={busy}
              className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-40 dark:text-red-400"
            >
              해제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
