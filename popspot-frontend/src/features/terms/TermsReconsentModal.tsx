'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, LogOut } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
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
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<TermsStatus | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiFetch('/api/v1/terms/status')
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as TermsStatus;
        if (cancelled) return;
        setStatus(data);
        if (data.needsReConsent) setOpen(true);
      })
      .catch(() => {
        /* 백엔드 일시 장애 — 다음에 다시 시도 */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      const res = await apiFetch('/api/v1/terms/accept', { method: 'POST' });
      // 아래 catch 가 바로 삼키는 개발자용 메시지라 화면에 뜨지 않는다 — 사전에 넣지 않는다.
      if (!res.ok) throw new Error('동의 처리에 실패했습니다.');
      setOpen(false);
    } catch {
      /* 실패 — 모달 유지 */
    } finally {
      setAccepting(false);
    }
  };

  if (!status?.needsReConsent) return null;

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
          <p>
            {t('terms.currentVersion')}{' '}
            <strong className="text-lime-500">v{status.currentVersion}</strong>
          </p>
          <p className="text-muted-foreground text-xs">
            {t('terms.agreedVersion')} v{status.agreedVersion ?? t('terms.noneAgreed')}
          </p>

          <div className="flex flex-col gap-1.5 text-xs">
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-500 hover:underline inline-flex items-center gap-1"
            >
              <FileText className="size-3" aria-hidden /> {t('terms.viewTerms')}
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-500 hover:underline inline-flex items-center gap-1"
            >
              <FileText className="size-3" aria-hidden /> {t('terms.viewPrivacy')}
            </Link>
          </div>
        </div>

        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconLeft={<LogOut className="size-3.5" aria-hidden />}
            onClick={onDecline}
          >
            {t('terms.decline')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={accepting}
            onClick={handleAccept}
          >
            {t('terms.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
