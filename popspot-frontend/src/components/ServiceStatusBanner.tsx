'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { useLocale } from '@/lib/i18n';
import {
  getServerServiceAvailability,
  getServiceAvailability,
  setServiceAvailability,
  subscribeServiceAvailability,
} from '@/lib/serviceAvailability';

const CHECK_WHEN_DOWN_MS = 15_000;
const CHECK_WHEN_UP_MS = 60_000;

const COPY = {
  ko: {
    title: '현재 서버 연결이 일시적으로 중단됨',
    detail:
      '공개 페이지는 계속 볼 수 있음. 서버가 복구되면 안내가 자동으로 사라지고 회원 기능도 다시 연결됨.',
  },
  en: {
    title: 'Member features are temporarily unavailable due to a server outage',
    detail: 'Public pages remain available. Login, saves and chat will reconnect automatically.',
  },
  ja: {
    title: 'サーバー停止のため会員機能を一時的に利用できません',
    detail:
      '公開ページは閲覧できます。復旧後、ログイン・お気に入り・チャットは自動で再接続します。',
  },
} as const;

export function useServiceAvailability() {
  return useSyncExternalStore(
    subscribeServiceAvailability,
    getServiceAvailability,
    getServerServiceAvailability,
  );
}

export default function ServiceStatusBanner() {
  const { locale } = useLocale();
  const status = useServiceAvailability();

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;

    function schedule(available: boolean) {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, available ? CHECK_WHEN_UP_MS : CHECK_WHEN_DOWN_MS);
    }

    async function check() {
      if (stopped || checking) return;
      checking = true;
      try {
        const response = await fetch(`/service-health?t=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(6_000),
        });
        const body = (await response.json()) as { available?: boolean };
        const available = response.ok && body.available === true;
        setServiceAvailability(available ? 'available' : 'unavailable');
        schedule(available);
      } catch {
        setServiceAvailability('unavailable');
        schedule(false);
      } finally {
        checking = false;
      }
    }

    const checkNow = () => {
      if (checking) return;
      if (timer) clearTimeout(timer);
      void check();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkNow();
    };

    void check();
    window.addEventListener('online', checkNow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', checkNow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (status !== 'unavailable') return null;
  const copy = COPY[locale];

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[10000] border-b border-amber-400/40 bg-amber-950/95 px-4 py-2.5 text-amber-50 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-2.5 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{copy.title}</p>
          <p className="mt-0.5 text-xs text-amber-100/80">{copy.detail}</p>
        </div>
        <RefreshCw className="mt-0.5 size-4 shrink-0 animate-spin text-amber-300" aria-hidden />
      </div>
    </aside>
  );
}
