import { ExternalLink } from 'lucide-react';
import { isPexelsPhoto, type CoverInput } from '@/lib/popupCover';
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

/** Pexels 스톡 사진을 실제 팝업 현장 사진으로 오인하지 않게 하는 고지와 출처. */
export function PhotoDisclosure({ popup, showCredit = false, className }: PhotoDisclosureProps) {
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
      <span>연출 이미지 · 실제 팝업 현장 아님</span>
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
