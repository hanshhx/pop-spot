'use client';

import { useState } from 'react';
import { Heart, MapPin } from 'lucide-react';
import { categoryVisual } from '@/components/main/categoryVisual';
import { cn } from '@/lib/utils';
import { popupCoverUrl } from '@/lib/popupCover';
import { PhotoDisclosure } from '@/components/popup/PhotoDisclosure';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { bilingual } from '@/lib/bilingual';
import type { PopupStore } from '@/types/popup';
import { trackVisitEvent } from '@/lib/visitEvent';
import { popupBadge } from '@/lib/popupBadges';
import { kstTodayStart } from '@/lib/popupSlices';

/**
 * 팝업 사진 카드 — 디자인 진단서 P0. 사진 + D-day + 지역 + 카테고리 + ♥ 를 한 장에.
 *
 * <p>기존 홈은 텍스트 랭킹 리스트라 "팝업을 눈으로 훑어보는" 코어 경험이 약했다. 크롤링 imageUrl 은 임의 호스트라
 * next/image 대신 순수 <img> 로 렌더(도메인 화이트리스트 불필요). 사진 없으면 지도핀 플레이스홀더.
 *
 * <p><b>전제: 이미 끝난 팝업은 넘어오지 않는다.</b> 이 카드를 쓰는 세 화면(홈 레일 · 랭킹 모달 ·
 * 음악 탭)은 모두 {@code keepOpenNow} 로 거른 목록을 넘긴다. 그래서 배지는 끝난 팝업을 따로
 * 다루지 않는다 — 만약 거르지 않은 목록을 넘기면 끝난 팝업이 <b>배지 없이</b> 멀쩡한 카드처럼
 * 보인다. 새 호출부를 만들 때 여기를 먼저 볼 것.
 */

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

export interface PopupCardProps {
  popup: PopupStore;
  onClick?: () => void;
  onWish?: () => void;
  wished?: boolean;
  className?: string;
  /**
   * 이 사용자가 이미 상세를 열어 본 팝업인가. 몇백 곳을 훑는 화면(POP-ALL)에서만 넘긴다 —
   * 본 것과 안 본 것이 구분되지 않으면 스크롤을 내려도 진도가 나가는 느낌이 없다.
   */
  seen?: boolean;
}

export function PopupCard({ popup, onClick, onWish, wished, className, seen }: PopupCardProps) {
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
  // 시작일도 함께 본다 — 종료일만 보던 예전 배지(ddayBadge)는 「오늘 오픈」을 알 수 없었고,
  // 종료일이 읽히는 모든 팝업에 같은 색 배지를 달아 D-1 과 D-127 이 구별되지 않았다.
  //
  // 기준 시각은 KST 달력 날짜다. 예전 dday.ts 는 로컬 setHours 를 써서, 서버(Vercel=UTC)와
  // 브라우저(KST)가 매일 아홉 시간 동안 서로 다른 날짜를 봤다 — 그 시간대엔 SSR 이 그린 배지와
  // 하이드레이션 후 배지가 하루 어긋났다.
  const badge = popupBadge(popup.startDate, popup.endDate, kstTodayStart());
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
  const catStyle = categoryVisual(popup.category);
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
        'group relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 sm:w-[220px] sm:shrink-0 dark:border-white/10 dark:bg-white/[0.04]',
        // 흐리게만 하고 끝내면 "고장난 카드" 로 읽힌다. hover 에서 원래대로 돌아오게 해서
        // <b>못 쓰는 것이 아니라 이미 본 것</b>임을 알린다.
        seen && 'opacity-60 saturate-[0.6] hover:opacity-100 hover:saturate-100',
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

        {/* 이번 계절에 마감하는 카드를 만채도(--s-hi)로 칠했더니 진행 중 588개 중 321개(54.6%)가
            해당했다 — 절반 넘게 칠해지면 그건 신호가 아니라 배경이고, 팔레트 규칙(만채도는 화면의
            10% 이내)도 어긴다. 그래서 지금은 사흘 이내(CLOSING_SOON_DAYS)만 빨강으로 튀고,
            넉 달 남은 팝업에는 아예 배지를 달지 않는다. 실제로 급한 것만 색을 쓴다. */}
        {badge && (
          <span
            className={cn(
              'absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
              badge.kind === 'closingSoon' && 'bg-red-500 text-white',
              badge.kind === 'openingToday' && 'bg-lime-300 text-ink-900',
              badge.kind === 'upcoming' && 'bg-black/65 text-white backdrop-blur',
            )}
          >
            {badge.kind === 'closingSoon'
              ? `${t('popall.badgeDday')}${badge.dday}`
              : badge.kind === 'openingToday'
                ? t('popall.badgeToday')
                : t('popall.badgeUpcoming')}
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
        {/* 흐리게 칠한 것만으로는 화면 낭독기 사용자에게 아무 뜻도 전달되지 않는다.
            색을 못 보는 사람에게도 같은 정보가 가야 한다. */}
        {seen && <span className="sr-only">{t('popall.seen')}</span>}
        <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
          {shownName.display || popup.name}
        </h3>
        {shownName.original && (
          <span className="truncate text-[10px] text-gray-400 dark:text-white/35">
            {shownName.original}
          </span>
        )}
        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/50">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{region}</span>
        </div>
        {cat && (
          <span className="mt-0.5 inline-flex w-fit rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/10 dark:text-white/60">
            {cat}
          </span>
        )}
      </div>
    </div>
  );
}

export default PopupCard;
