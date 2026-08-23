'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

import { useLocale } from '@/lib/i18n';
import {
  availabilityAfterFailure,
  getServerServiceAvailability,
  getServiceAvailability,
  setServiceAvailability,
  shouldRunHealthCheck,
  subscribeServiceAvailability,
} from '@/lib/serviceAvailability';

const CHECK_WHEN_DOWN_MS = 15_000;
const CHECK_WHEN_UP_MS = 60_000;
const RECOVERY_SUCCESS_COUNT = 3;
const RECOVERY_STABLE_MS = 60_000;
const COLLAPSED_SESSION_KEY = 'popspot:service-banner-collapsed';

const COPY = {
  ko: {
    title: '현재 서버 연결이 일시적으로 중단됨',
    detail:
      '공개 페이지는 계속 볼 수 있음. 서버가 복구되면 안내가 자동으로 사라지고 회원 기능도 다시 연결됨.',
    collapse: '접기',
    expand: '펼치기',
  },
  en: {
    title: 'Member features are temporarily unavailable due to a server outage',
    detail: 'Public pages remain available. Login, saves and chat will reconnect automatically.',
    collapse: 'Collapse',
    expand: 'Expand',
  },
  ja: {
    title: 'サーバー停止のため会員機能を一時的に利用できません',
    detail:
      '公開ページは閲覧できます。復旧後、ログイン・お気に入り・チャットは自動で再接続します。',
    collapse: '折りたたむ',
    expand: '開く',
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.sessionStorage.getItem(COLLAPSED_SESSION_KEY);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    // 꺼져 있으면 아무것도 재지 않는다. 상태가 'checking' 에 머물러 배너·로그인 화면·
    // api.ts 의 사전 차단이 모두 평소대로 동작한다. 경위는 shouldRunHealthCheck 주석.
    if (!shouldRunHealthCheck()) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;
    let recoverySuccesses = 0;
    let recoveryStartedAt = 0;
    let consecutiveFailures = 0;

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
          // 상태 확인 경로는 프로세스·공개 목록을 동시에 보고, 그다음 실제 상세 하나를 본다.
          signal: AbortSignal.timeout(12_000),
        });
        const body = (await response.json()) as { available?: boolean };
        const available = response.ok && body.available === true;
        const current = getServiceAvailability();
        if (!available) {
          recoverySuccesses = 0;
          recoveryStartedAt = 0;
          consecutiveFailures += 1;
          // 첫 실패로는 선언하지 않는다. 15초 뒤 한 번 더 보고 그때도 실패면 장애다.
          const declared = availabilityAfterFailure(consecutiveFailures);
          if (declared) setServiceAvailability(declared);
          schedule(false);
          return;
        }

        consecutiveFailures = 0;
        if (current !== 'unavailable') {
          // 정상 방문자는 복구 대기 시간을 겪지 않는다. 대기 조건은 장애를 실제로 확인한 탭에만 적용한다.
          setServiceAvailability('available');
          schedule(true);
        } else {
          recoverySuccesses += 1;
          if (recoveryStartedAt === 0) recoveryStartedAt = Date.now();
          const stableFor = Date.now() - recoveryStartedAt;
          const recovered =
            recoverySuccesses >= RECOVERY_SUCCESS_COUNT && stableFor >= RECOVERY_STABLE_MS;
          if (recovered) setServiceAvailability('available');
          schedule(recovered);
        }
      } catch {
        // 제한시간 초과·네트워크 오류도 위와 같게 센다. 한 번 느린 것과 진짜 장애를 구분한다.
        recoverySuccesses = 0;
        recoveryStartedAt = 0;
        consecutiveFailures += 1;
        const declared = availabilityAfterFailure(consecutiveFailures);
        if (declared) setServiceAvailability(declared);
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

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.sessionStorage.setItem(COLLAPSED_SESSION_KEY, String(next));
      return next;
    });
  };

  if (collapsed) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed right-3 top-3 z-[10000] max-w-[calc(100vw-1.5rem)]"
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded="false"
          className="flex min-h-11 items-center gap-2 rounded-full border border-amber-400/40 bg-amber-950/95 px-3.5 py-2 text-left text-xs font-bold text-amber-50 shadow-lg backdrop-blur transition hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2"
        >
          <AlertTriangle className="size-4 shrink-0 text-amber-300" aria-hidden />
          <span className="sm:hidden">
            {locale === 'ko'
              ? '서버 일시 중단 · 자세히'
              : locale === 'ja'
                ? 'サーバー停止中 · 詳細'
                : 'Server paused · Details'}
          </span>
          <span className="hidden truncate sm:inline">{copy.title}</span>
          <ChevronDown className="size-4 shrink-0 text-amber-200" aria-hidden />
          <span className="sr-only">{copy.expand}</span>
        </button>
      </aside>
    );
  }

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
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded="true"
          className="-mr-1 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-bold text-amber-100 transition hover:bg-amber-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <ChevronUp className="size-4" aria-hidden />
          <span className="hidden sm:inline">{copy.collapse}</span>
        </button>
      </div>
    </aside>
  );
}
