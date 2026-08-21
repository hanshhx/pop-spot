'use client';

import { useState } from 'react';
import { Heart, MapPin, Shirt, Coffee, Palette, Star, Sparkles, Cpu, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DDAY_TONE_CLASS, ddayTone } from '@/lib/ddayTone';
import { popupCoverUrl } from '@/lib/popupCover';
import { PhotoDisclosure } from '@/components/popup/PhotoDisclosure';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { bilingual } from '@/lib/bilingual';
import type { PopupStore } from '@/types/popup';
import { trackVisitEvent } from '@/lib/visitEvent';

/**
 * 팝업 사진 카드 — 디자인 진단서 P0. 사진 + D-day + 지역 + 카테고리 + ♥ 를 한 장에.
 *
 * <p>기존 홈은 텍스트 랭킹 리스트라 "팝업을 눈으로 훑어보는" 코어 경험이 약했다. 크롤링 imageUrl 은 임의 호스트라
 * next/image 대신 순수 <img> 로 렌더(도메인 화이트리스트 불필요). 사진 없으면 지도핀 플레이스홀더.
 */

/** 남은 기간 배지에 필요한 것 — 무엇을 쓸지(labelKey · days)와 어떤 색으로 그릴지(ended). */
interface DdayBadge {
  /** 정해진 문구가 있는 경우의 사전 키. 남은 일수를 세어 보여줄 때는 null. */
  labelKey: MessageKey | null;
  days: number;
  ended: boolean;
}

/**
 * 마감까지 남은 기간.
 *
 * <p>문구와 <b>종료 여부를 나눠서</b> 돌려준다. 예전에는 '종료' 같은 문자열 하나만 주고 배지 색을
 * 고르는 쪽이 {@code dday === '종료'} 로 되물었는데, 그러면 문구를 옮기는 순간 비교가 빗나가
 * 끝난 팝업까지 라임색 배지를 달게 된다 — 보이는 글자와 판단 기준이 같은 값이면 늘 이렇게 된다.
 */
function ddayBadge(endDate?: string): DdayBadge | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { labelKey: 'misc.cardEnded', days: diff, ended: true };
  if (diff === 0) return { labelKey: 'card.today', days: 0, ended: false };
  return { labelKey: null, days: diff, ended: false };
}

/**
 * 백엔드 카테고리 코드 → 표시 문구.
 *
 * <p>코드가 아니라 <b>키</b>를 담는다 — 이 배열은 컴포넌트 밖이라 훅을 부를 수 없고, 문구는 그리는
 * 쪽에서 t() 로 꺼낸다. 여기에 없는 코드는 크롤링 원문을 그대로 보여준다(아래 cat 참고).
 */
const CATEGORY_LABEL_KEY: Record<string, MessageKey> = {
  FASHION: 'misc.catFashion',
  FOOD: 'misc.catFood',
  CULTURE: 'misc.catCulture',
  CHARACTER: 'misc.catCharacter',
  BEAUTY: 'misc.catBeauty',
  TECH: 'misc.catTech',
  ETC: 'misc.catEtc',
};

/**
 * 사진이 없을 때(자동수집 팝업 대부분)의 플레이스홀더 스타일. 카테고리별 브랜드 그라디언트 + 아이콘 —
 * 잘못된 사진을 붙이는 대신 "의도된 디자인"으로 보이게. 색은 소스에 문자열 리터럴로 박아 Tailwind JIT 가 인식.
 */
const CATEGORY_STYLE: Record<string, { grad: string; Icon: typeof MapPin }> = {
  FASHION: { grad: 'from-pink-200 to-rose-300', Icon: Shirt },
  FOOD: { grad: 'from-amber-200 to-orange-300', Icon: Coffee },
  CULTURE: { grad: 'from-violet-200 to-indigo-300', Icon: Palette },
  CHARACTER: { grad: 'from-lime-200 to-emerald-300', Icon: Star },
  BEAUTY: { grad: 'from-fuchsia-200 to-pink-300', Icon: Sparkles },
  TECH: { grad: 'from-sky-200 to-cyan-300', Icon: Cpu },
  ETC: { grad: 'from-gray-200 to-gray-300', Icon: Store },
};

export interface PopupCardProps {
  popup: PopupStore;
  onClick?: () => void;
  onWish?: () => void;
  wished?: boolean;
  className?: string;
}

export function PopupCard({ popup, onClick, onWish, wished, className }: PopupCardProps) {
  /**
   * 카드가 눌렸다 — 어떤 팝업이 실제로 관심을 받는지 남긴다.
   *
   * <p>세 화면(홈·전체보기·음악 탭)이 이 컴포넌트를 쓴다. 각 화면의 onClick 에 따로 붙이면
   * 새 화면이 생길 때마다 빠뜨리므로 여기 한 곳에 둔다.
   *
   * <p>기록이 실패해도 화면 이동은 그대로 진행된다 — 통계 때문에 카드가 안 열리면 안 된다.
   */
  const handleOpen = () => {
    trackVisitEvent('popup_open', { popupId: popup.id });
    onClick?.();
  };

  const { t, locale } = useLocale();
  const [imgError, setImgError] = useState(false);
  const dday = ddayBadge(popup.endDate);
  const catKey = popup.category ? CATEGORY_LABEL_KEY[popup.category.toUpperCase()] : undefined;
  // 아는 코드면 옮기고, 모르는 값이면 크롤링 원문을 그대로 — 지어내는 것보다 원문이 낫다.
  const cat = catKey ? t(catKey) : popup.category || null;
  const shownName = bilingual(
    popup.name,
    locale === 'en' ? popup.nameEn : locale === 'ja' ? popup.nameJa : null,
  );
  const shownPlace = bilingual(
    popup.location,
    locale === 'en' ? popup.locationEn : locale === 'ja' ? popup.locationJa : null,
  );
  const region =
    (shownPlace.display || '').split(' ').slice(0, 3).join(' ') || t('misc.cardRegionSeoul');
  const catStyle = CATEGORY_STYLE[popup.category?.toUpperCase() ?? 'ETC'] ?? CATEGORY_STYLE.ETC;
  const coverUrl = popupCoverUrl(popup);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        'group relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm card-lift hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 sm:w-[220px] sm:shrink-0 dark:border-white/10 dark:bg-white/[0.04]',
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100 sm:aspect-[4/5] dark:bg-white/5">
        {coverUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={shownName.display || popup.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${catStyle.grad}`}
          >
            <catStyle.Icon size={40} strokeWidth={1.5} className="text-white/60" />
          </div>
        )}

        {dday && (
          /* 색은 lib/ddayTone 이 정한다. 예전에는 끝난 것/아닌 것 두 갈래로만 나눠 진행 중인
             팝업이 전부 라임이었다 — 목록 전체가 라임으로 덮여 정작 급한 것이 안 보였다. */
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              DDAY_TONE_CLASS[ddayTone(dday.days) ?? 'calm']
            }`}
          >
            {dday.labelKey
              ? t(dday.labelKey)
              : `${t('misc.cardDdayPrefix')}${dday.days}${t('misc.cardDdaySuffix')}`}
          </span>
        )}

        {onWish && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWish();
            }}
            aria-label={t('misc.cardWish')}
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-hot-400 backdrop-blur transition hover:bg-white dark:bg-black/50"
          >
            <Heart size={15} fill={wished ? 'currentColor' : 'none'} />
          </button>
        )}
        <PhotoDisclosure popup={popup} className="absolute bottom-2.5 left-2.5 right-2.5 w-fit" />
      </div>

      <div className="flex flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-bold text-foreground">
          {shownName.display || popup.name}
        </h3>
        {shownName.original && (
          <span className="truncate text-[10px] text-subtle-foreground">
            {shownName.original}
          </span>
        )}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{region}</span>
        </div>
        {cat && (
          <span className="mt-0.5 inline-flex w-fit rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-white/10">
            {cat}
          </span>
        )}
      </div>
    </div>
  );
}

export default PopupCard;
