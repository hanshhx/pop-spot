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
import { saveHomeReturnState } from '@/lib/homeReturnScroll';
import { useHistoryBackedModal } from '@/features/popup/useHistoryBackedModal';
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
 * 상세 페이지가 실제로 열린 횟수(viewCount) 내림차순으로 정렬한다. 호출부는 지도에 표시할 수 있는
 * 팝업만 넘겨, 목록에서 고른 팝업을 지도에서도 찾을 수 있게 한다.
 *
 * <p>제목은 메인 섹션과 같은 말이라 {@code section.ranking} 을 같이 쓴다 — 눌러서 연 모달의 제목이
 * 눌렀던 섹션과 다른 말이면 다른 화면으로 온 것처럼 읽힌다.
 *
 * <p><b>뒤로가기.</b> 열릴 때 history 항목을 하나 쌓아({@link useHistoryBackedModal}) 모바일
 * 뒤로가기가 사이트를 떠나지 않고 이 목록만 닫게 한다. 카드를 눌러 상세로 가는 것은 "닫힌 것"이
 * 아니라 "떠나는 것"이라 그 항목을 {@code history.back()} 으로 소비하지 않고, 대신
 * {@code router.replace} 로 같은 항목을 상세 페이지 URL로 바꿔치기한다 — 그러면 상세에서 뒤로
 * 한 번이면 곧장 목록을 열기 전의 홈으로 돌아간다(목록은 다시 열리지 않는다. 목록이 떠 있는
 * 동안 배경 스크롤은 잠겨 있어 "있던 자리"는 곧 그때의 홈 스크롤 위치이지 목록 내부 위치가
 * 아니다 — 그래서 홈이 다시 그 자리로 돌아오는 것만으로 충분하다).
 */
export function AllTrendingModal({ open, onOpenChange, popups }: AllTrendingModalProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const ranked = [...popups].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const { onOpenChange: handleOpenChange, notifyNavigatingAway } = useHistoryBackedModal(
    open,
    onOpenChange,
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                      // 닫는 게 아니라 떠나는 것 — history 항목을 back() 으로 소비하지 않는다.
                      // 대신 아래 router.replace 가 같은 항목을 상세 URL 로 바꿔치기한다.
                      notifyNavigatingAway();
                      saveHomeReturnState();
                      onOpenChange(false);
                      router.replace(localizedPath(`/popup/${popup.id}`, locale));
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
