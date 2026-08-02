'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PopupCard } from '@/components/main/PopupCard';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import type { PopupStore } from '@/types/popup';

interface AllTrendingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popups: PopupStore[];
}

/**
 * 실시간 랭킹 — 사진 카드 그리드 모달.
 *
 * <p>메인 랭킹 타일을 누르면 열린다. 텍스트 리스트 대신 팝업 <b>사진 + 이름</b> 카드로 보여주고,
 * 조회수(인기) 내림차순으로 정렬한다.
 *
 * <p>제목은 메인 섹션과 같은 말이라 {@code section.ranking} 을 같이 쓴다 — 눌러서 연 모달의 제목이
 * 눌렀던 섹션과 다른 말이면 다른 화면으로 온 것처럼 읽힌다.
 */
export function AllTrendingModal({ open, onOpenChange, popups }: AllTrendingModalProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const ranked = [...popups].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl md:text-2xl font-black">
            {t('section.ranking')}
            <span className="text-lime-400">·</span>
          </DialogTitle>
          <DialogDescription>{t('pmodal.trending.desc')}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto custom-scrollbar -mx-1 px-1">
          {ranked.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] animate-pulse rounded-2xl bg-cream-300 dark:bg-ink-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {ranked.map((popup, idx) => (
                <div key={popup.id} className="relative">
                  <span
                    className={`absolute right-2 top-2 z-10 grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-black tabular-nums shadow ${
                      idx < 3 ? 'bg-lime-300 text-ink-900' : 'bg-black/55 text-white backdrop-blur'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <PopupCard
                    popup={popup}
                    className="w-full"
                    onClick={() => {
                      onOpenChange(false);
                      router.push(localizedPath(`/popup/${popup.id}`, locale));
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
