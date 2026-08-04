'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, FileText, LogOut } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TermsStatus {
  currentVersion: string;
  agreedVersion: string | null;
  currentTermsVersion: string;
  currentPrivacyVersion: string;
  agreedTermsVersion: string | null;
  agreedPrivacyVersion: string | null;
  age14OrOlderVerified: boolean;
  needsReConsent: boolean;
}

interface TermsReconsentModalProps {
  /** 로그인 사용자가 있을 때만 호출. 비로그인이면 부모가 렌더 안 함. */
  enabled: boolean;
  /** 사용자가 동의 거절했을 때 호출 — 부모가 로그아웃 처리. */
  onDecline: () => void;
}

/**
 * v2.20 — 약관 재동의 모달.
 *
 * <p>{@code GET /api/v1/terms/status} 로 현재 버전과 본인 동의 버전을 비교해 다르면 모달 강제. 사용자가
 * 동의하면 {@code POST /api/v1/terms/accept} 호출 후 모달 닫음. 거절하면 부모의 onDecline 으로
 * 로그아웃 유도.
 *
 * <p>마운트 시점에 한 번만 status 조회. 재로그인 / 다음 세션에 다시 확인됨.
 */
export function TermsReconsentModal({ enabled, onDecline }: TermsReconsentModalProps) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<TermsStatus | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreements, setAgreements] = useState({ age: false, terms: false, privacy: false });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    /**
     * 재동의 여부는 <b>물어보지 못하면 그냥 넘어가서는 안 되는</b> 값이다. 예전엔 조회가 실패하면
     * 조용히 포기했는데, 그러면 재동의가 필요한 사용자에게 모달이 이번 세션 내내 뜨지 않는다 —
     * 화면상으로는 아무 문제가 없어 보이지만 동의를 못 받은 채로 서비스가 계속된다.
     *
     * 그래서 실패하면 물러나며 다시 시도한다(5초 → 15초 → 45초, 3회). 그래도 안 되면 다음
     * 세션에 다시 확인된다.
     */
    const check = (attempt: number) => {
      apiFetch('/api/v1/terms/status')
        .then(async (res) => {
          if (cancelled) return;
          if (!res.ok) throw new Error(`terms status ${res.status}`);
          const data = (await res.json()) as TermsStatus;
          if (cancelled) return;
          setStatus(data);
          if (data.needsReConsent) setOpen(true);
        })
        .catch(() => {
          if (cancelled || attempt >= 3) return;
          timer = setTimeout(() => check(attempt + 1), 5000 * 3 ** (attempt - 1));
        });
    };
    check(1);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/terms/accept', {
        method: 'POST',
        body: JSON.stringify({
          age14OrOlder: agreements.age,
          termsAccepted: agreements.terms,
          privacyAccepted: agreements.privacy,
        }),
      });
      // 아래 catch 가 바로 삼키는 개발자용 메시지라 화면에 뜨지 않는다 — 사전에 넣지 않는다.
      if (!res.ok) throw new Error('동의 처리에 실패했습니다.');
      setOpen(false);
    } catch {
      setError(
        locale === 'en'
          ? 'Could not save your choice. Please try again.'
          : locale === 'ja'
            ? '選択を保存できませんでした。もう一度お試しください。'
            : '선택을 저장하지 못했습니다. 다시 시도해주세요.',
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (declining) return;
    setDeclining(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/terms/decline', { method: 'POST' });
      if (!res.ok) throw new Error('DECLINE_FAILED');
      onDecline();
    } catch {
      setError(
        locale === 'en'
          ? 'Could not process your choice. Please try again.'
          : locale === 'ja'
            ? '選択を処理できませんでした。もう一度お試しください。'
            : '선택을 처리하지 못했습니다. 다시 시도해주세요.',
      );
    } finally {
      setDeclining(false);
    }
  };

  if (!status?.needsReConsent) return null;
  const allAgreed = agreements.age && agreements.terms && agreements.privacy;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // ESC / 외부 클릭으로 닫는 것 차단 — 동의 / 거절 둘 중 하나만.
        if (!v && status.needsReConsent) return;
        setOpen(v);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-lime-500" aria-hidden /> {t('terms.updatedTitle')}
          </DialogTitle>
          <DialogDescription>{t('terms.updatedDesc')}</DialogDescription>
        </DialogHeader>

        <div className="py-2 text-sm text-foreground space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('terms.viewTerms')} v{status.currentTermsVersion} · {t('terms.viewPrivacy')} v
            {status.currentPrivacyVersion}
          </p>

          <div className="flex flex-col gap-1.5 text-xs">
            <Link
              href={localizedPath('/terms', locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-500 hover:underline inline-flex items-center gap-1"
            >
              <FileText className="size-3" aria-hidden /> {t('terms.viewTerms')}
            </Link>
            <Link
              href={localizedPath('/privacy', locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-500 hover:underline inline-flex items-center gap-1"
            >
              <FileText className="size-3" aria-hidden /> {t('terms.viewPrivacy')}
            </Link>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            {[
              { key: 'age' as const, label: t('signup.ageNotice') },
              { key: 'terms' as const, label: t('signup.termsRequired') },
              { key: 'privacy' as const, label: t('signup.privacyRequired') },
            ].map((item) => (
              <label key={item.key} className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={agreements[item.key]}
                  onChange={() =>
                    setAgreements((previous) => ({
                      ...previous,
                      [item.key]: !previous[item.key],
                    }))
                  }
                />
                <span
                  aria-hidden
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    agreements[item.key]
                      ? 'border-lime-400 bg-lime-400 text-ink-900'
                      : 'border-border'
                  }`}
                >
                  {agreements[item.key] && <Check className="size-3" />}
                </span>
                {item.label}
              </label>
            ))}
          </div>
          {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
        </div>

        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconLeft={<LogOut className="size-3.5" aria-hidden />}
            loading={declining}
            onClick={handleDecline}
          >
            {t('terms.decline')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={accepting}
            disabled={!allAgreed}
            onClick={handleAccept}
          >
            {t('terms.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
