'use client';

import { ExternalLink } from 'lucide-react';
import { isPexelsPhoto, type CoverInput } from '@/lib/popupCover';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PhotoDisclosureProps {
  popup: CoverInput;
  showCredit?: boolean;
  className?: string;
}

function trustedPexelsUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'pexels.com' || host.endsWith('.pexels.com'))
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Pexels 스톡 사진을 실제 팝업 현장 사진으로 오인하지 않게 하는 고지와 출처.
 *
 * <p>고지가 목적인 문구라 <b>읽는 사람의 언어로 나와야 한다</b> — 한국어로만 띄우면 정작 현장을
 * 찾아가는 외국인에게는 고지가 되지 않는다. 그래서 클라이언트 컴포넌트로 둔다. 부르는 쪽은 모두
 * 'use client' 화면이라 경계가 새로 생기지는 않는다.
 *
 * <p>Pexels 크레딧("Photo by … on Pexels")은 옮기지 않는다 — 제공처가 요구하는 표기 형식이다.
 */
export function PhotoDisclosure({ popup, showCredit = false, className }: PhotoDisclosureProps) {
  const { t } = useLocale();
  if (!isPexelsPhoto(popup)) return null;

  const photoUrl = trustedPexelsUrl(popup.photoSourceUrl) ?? 'https://www.pexels.com/';
  const creditUrl = trustedPexelsUrl(popup.photoCreditUrl) ?? photoUrl;
  const creditName = popup.photoCreditName?.trim();

  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-black/70 px-2.5 py-1.5 text-[10px] font-semibold leading-tight text-white backdrop-blur-md',
        className,
      )}
    >
      <span>{t('photo.styledTooltip')}</span>
      {showCredit && (
        <a
          href={creditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-white/80 underline underline-offset-2 hover:text-white"
        >
          Photo by {creditName || 'Pexels'} on Pexels
          <ExternalLink size={10} aria-hidden />
        </a>
      )}
    </div>
  );
}
