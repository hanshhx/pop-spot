'use client';

import { revokeExternalMediaConsent, useExternalMediaConsent } from '@/lib/externalMediaConsent';

/** 외부 영상 연결 동의를 이 브라우저에서 철회하는 최소 제어 화면. */
export function ExternalMediaConsentControl() {
  const consented = useExternalMediaConsent();
  if (!consented) return null;

  return (
    <button
      type="button"
      onClick={revokeExternalMediaConsent}
      className="mt-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-bold transition hover:bg-foreground/5"
    >
      이 브라우저의 YouTube 연결 동의 철회
    </button>
  );
}
