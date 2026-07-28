'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Disc3, Loader2, Music2, X } from 'lucide-react';

import { notify } from '@/lib/notify';
import { useLocale } from '@/lib/i18n';
import { useSpotifyAuth } from './useSpotifyAuth';

/**
 * v2.21-S11 — 음악 탭 헤더에 박을 Spotify 연결 칩.
 *
 * <p>3가지 상태:
 *
 * <ul>
 *   <li>미연결 — 녹색 "Spotify 연결" 버튼 (클릭 시 Spotify 로그인 페이지로)
 *   <li>연결 + Premium — 라임 "Premium 연결됨" 배지 + X 로 끊기
 *   <li>연결 + Free — 회색 "연결됨 (Free)" 배지 + X 로 끊기 + 안내 텍스트
 * </ul>
 *
 * <p>콜백 후 URL 에 ?spotify=connected/error/denied 가 붙어 돌아오면 즉시 토스트.
 *
 * <p>Spotify 어트리뷰션 (Branding Guidelines) — 버튼/배지에 Spotify 로고 (Disc3 아이콘 +
 * "Spotify" 텍스트) 명시. v2.21-S14 에서 공식 SVG 로 교체 예정.
 */

export function SpotifyConnectButton() {
  const { connected, isPremium, loading, startLogin, disconnect, refresh } = useSpotifyAuth();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  /*
   * 콜백 결과는 한 번만 알린다.
   *
   * 아래에서 replaceState 로 ?spotify= 를 지워도 useSearchParams 가 보는 값은 그대로다 —
   * 라우터를 거치지 않은 주소 변경이라 Next 가 모른다. t 가 의존성에 들어온 뒤로는 언어를 바꿀
   * 때마다 이 효과가 다시 돌아 같은 토스트가 또 떴다. 처리 여부를 ref 로 붙잡아 막는다.
   */
  const calloutShownRef = useRef(false);

  // 콜백 후 토스트 + 상태 갱신 + URL 정리
  useEffect(() => {
    const status = searchParams?.get('spotify');
    if (!status || calloutShownRef.current) return;
    calloutShownRef.current = true;

    // 분기 값(connected / denied / error)은 백엔드 콜백이 붙여 보내는 것이라 그대로 두고,
    // 화면에 나가는 문구만 언어에 맞춘다.
    if (status === 'connected') {
      notify({
        icon: 'success',
        title: t('spotify.connectedTitle'),
        text: t('spotify.connectedText'),
        timer: 3000,
      });
      void refresh();
    } else if (status === 'denied') {
      notify({
        icon: 'info',
        title: t('spotify.deniedTitle'),
        text: t('spotify.deniedText'),
        timer: 2500,
      });
    } else if (status === 'error') {
      notify({
        icon: 'error',
        title: t('spotify.failedTitle'),
        text: t('spotify.retryLater'),
        timer: 3000,
      });
    }

    // URL 에서 ?spotify= 쿼리 제거 (history 더럽히지 않음)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('spotify');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, refresh, t]);

  async function handleConnect() {
    try {
      await startLogin();
    } catch (e) {
      notify({
        icon: 'error',
        title: t('spotify.startFailedTitle'),
        // e.message 는 useSpotifyAuth 가 던지는 한국어 원인 문자열이다. 사전이 아니라 훅에 있어
        // 여기서는 못 옮긴다 — 훅을 손대는 차례에 함께 정리한다.
        text: e instanceof Error ? e.message : t('spotify.retryLater'),
      });
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(t('spotify.disconnectConfirm'))) {
      return;
    }
    try {
      await disconnect();
      notify({
        icon: 'success',
        title: t('spotify.disconnectedTitle'),
        timer: 2000,
      });
    } catch {
      notify({
        icon: 'error',
        title: t('spotify.disconnectFailedTitle'),
        text: t('spotify.retryLater'),
      });
    }
  }

  if (loading) {
    return (
      <span
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill border border-gray-200 dark:border-white/10 text-xs text-muted-foreground"
        aria-label={t('spotify.checkingAria')}
      >
        <Loader2 size={12} className="animate-spin" />
        {t('spotify.checking')}
      </span>
    );
  }

  if (!connected) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        aria-label={t('spotify.connectAria')}
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-xs font-bold transition-all bg-[#1DB954] text-white hover:bg-[#1ed760] shadow-sm hover:shadow-md"
      >
        <Disc3 size={14} className="shrink-0" />
        <span>{t('spotify.connect')}</span>
      </button>
    );
  }

  // 연결됨 — Premium / Free 구분
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-xs font-bold ${
          isPremium
            ? 'bg-lime-300 text-ink-900 border border-lime-400'
            : 'bg-gray-100 text-gray-700 border border-gray-300 dark:bg-white/10 dark:text-white dark:border-white/15'
        }`}
        title={isPremium ? t('spotify.premiumTip') : t('spotify.freeTip')}
      >
        <Music2 size={12} className="shrink-0" />
        <Check size={12} className="shrink-0" />
        {/* 요금제 이름은 Spotify 가 어느 나라에서나 그대로 쓰는 표기라 옮기지 않는다. */}
        <span>{isPremium ? 'Spotify Premium' : 'Spotify Free'}</span>
      </span>
      <button
        type="button"
        onClick={handleDisconnect}
        aria-label={t('spotify.disconnect')}
        title={t('spotify.disconnect')}
        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}
