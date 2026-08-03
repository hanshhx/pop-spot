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
      className={`inline-flex items-center text-[10px] font-semibold text-[#1DB954] hover:underline ${className}`}
      aria-label={label}
    >
      {label}
    </a>
  );
}
