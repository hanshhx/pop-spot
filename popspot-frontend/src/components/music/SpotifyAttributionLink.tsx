'use client';

import { useLocale } from '@/lib/i18n';

interface SpotifyAttributionLinkProps {
  trackId?: string | null;
  className?: string;
}

/** Spotify에서 제공한 곡 정보 옆에 원문 링크와 서비스 표시를 함께 제공한다. */
export function SpotifyAttributionLink({ trackId, className = '' }: SpotifyAttributionLinkProps) {
  const { locale } = useLocale();
  if (!trackId) return null;

  const label =
    locale === 'en' ? 'Open in Spotify' : locale === 'ja' ? 'Spotifyで開く' : 'Spotify에서 열기';

  return (
    <a
      href={`https://open.spotify.com/track/${encodeURIComponent(trackId)}`}
      target="_blank"
      rel="noopener noreferrer"
      /*
       * Spotify 약관이 요구하는 출처 링크다. 실제로 눌러 곡을 여는 자리이기도 한데 높이가
       * 글자 높이(15px)뿐이라 손가락으로 맞히기 어려웠다. 글자 크기는 그대로 두고 위아래
       * 여백으로 누를 면적만 넓힌다.
       */
      className={`inline-flex min-h-11 items-center py-2 text-[10px] font-semibold text-[#1DB954] hover:underline ${className}`}
      aria-label={label}
    >
      {label}
    </a>
  );
}
