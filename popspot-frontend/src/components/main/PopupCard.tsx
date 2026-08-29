'use client';

import { useState } from 'react';
import Link from 'next/link';
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

interface PopupCardBase {
  popup: PopupStore;
  onClick?: () => void;
  className?: string;
  /**
   * 이 사용자가 이미 상세를 열어 본 팝업인가. 몇백 곳을 훑는 화면(POP-ALL)에서만 넘긴다 —
   * 본 것과 안 본 것이 구분되지 않으면 스크롤을 내려도 진도가 나가는 느낌이 없다.
   */
  seen?: boolean;
}

/**
 * 카드의 두 모습.
 *
 * <p><b>{@code href} 를 주면 카드가 진짜 링크가 된다.</b> 검색엔진이 따라갈 수 있고, 가운데 클릭·
 * 새 탭·주소 복사가 브라우저 기본 동작으로 된다. 실측(2026-08-29): 홈이 내보내는 HTML 에
 * {@code href="/popup/숫자"} 가 <b>0개</b>였다 — 사이트에서 가장 강한 페이지가 상세로 권한을 한
 * 방울도 흘리지 않고 있었다(같은 시각 랜딩 한 장은 66개를 냈다).
 *
 * <p>{@code href} 와 {@code onWish} 는 <b>함께 쓸 수 없다.</b> 앵커 안에 버튼을 넣으면 잘못된
 * HTML 이라 브라우저가 마음대로 구조를 고친다. 타입으로 막아 둔다 — 주석은 언젠가 안 읽히지만
 * 컴파일러는 매번 읽는다. 둘 다 필요해지면 'stretched link' 로 다시 짜야 한다.
 */
export type PopupCardProps = PopupCardBase &
  (
    | { href: string; onWish?: never; wished?: never }
    | { href?: undefined; onWish?: () => void; wished?: boolean }
  );

export function PopupCard({
  popup,
  onClick,
  onWish,
  wished,
  className,
  seen,
  href,
}: PopupCardProps) {
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

  const cardClassName = cn(
    /*
     * 폭은 <b>부르는 쪽이 정한다.</b> 카드 자신은 언제나 제 자리를 채운다({@code w-full}).
     *
     * 예전엔 여기 {@code sm:w-[220px] sm:shrink-0} 가 박혀 있었다. 레일 때문에 넣은 값인데
     * 정작 레일은 감싸개(HomeClient 의 {@code w-[168px] sm:w-[220px]})가 폭을 정하고 있어서
     * 쓰이지도 않았고, <b>격자에서는 셀보다 좁게 굳어</b> 칸마다 빈틈을 만들었다. 부르는 쪽이
     * {@code className="w-full"} 로 채우라고 해도 같은 브레이크포인트가 아니라 이기지 못했다
     * (1600px 에서 셀 234px 대 카드 220px, 넓은 화면일수록 더 벌어졌다).
     */
    'group relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 dark:border-white/10 dark:bg-white/[0.04]',
    // 흐리게만 하고 끝내면 "고장난 카드" 로 읽힌다. hover 에서 원래대로 돌아오게 해서
    // <b>못 쓰는 것이 아니라 이미 본 것</b>임을 알린다.
    seen && 'opacity-60 saturate-[0.6] hover:opacity-100 hover:saturate-100',
    className,
  );

  const content = (
    <>
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
    </>
  );

  /*
   * 주소가 있으면 진짜 링크로 그린다.
   *
   * <p>{@code role="button"} 을 쓰던 예전 방식은 화면상 똑같이 보이지만 <b>주소가 없다</b> —
   * 검색엔진이 따라갈 수 없고, 가운데 클릭·새 탭·주소 복사도 안 된다. 앵커로 바꾸면 그 넷이
   * 브라우저 기본 동작으로 딸려 오므로 {@code tabIndex}·{@code onKeyDown} 도 필요 없어진다.
   *
   * <p>{@code prefetch={false}} 인 이유는 비용이다. Next 는 화면에 들어온 링크를 미리 당겨오는데,
   * 레일 한 줄이 카드 스무 장이면 상세 페이지를 스무 번 미리 부른다. {@code /api} 가 라우트
   * 핸들러로 옮겨간 뒤로 그 하나하나가 서버리스 함수 호출이고, 이 프로젝트는 인프라 비용 0원이
   * 절대 조건이다. 사람이 실제로 누른 것만 부른다.
   */
  if (href) {
    return (
      <Link href={href} prefetch={false} onClick={handleOpen} className={cardClassName}>
        {content}
      </Link>
    );
  }

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
      className={cardClassName}
    >
      {content}
    </div>
  );
}

export default PopupCard;
