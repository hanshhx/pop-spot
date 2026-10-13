'use client';

import { useState } from 'react';
import { ArrowRight, Heart, Store } from 'lucide-react';
import { bilingual } from '@/lib/bilingual';
import { localizedLabel, useLocale } from '@/lib/i18n';
import { isPexelsPhoto, popupCoverUrl } from '@/lib/popupCover';
import { popupBadge } from '@/lib/popupBadges';
import { CATEGORIES, classifyCategory, kstTodayStart } from '@/lib/popupSlices';
import type { PopupStore } from '@/types/popup';
import style from './HomeFamily.module.css';

const COPY = {
  ko: { next: '다른 팝업 보기', pending: '사진 준비 중', unknown: '종료일 확인 필요' },
  en: { next: 'See another pop-up', pending: 'Photo coming soon', unknown: 'End date unconfirmed' },
  ja: { next: 'ほかのポップアップ', pending: '写真準備中', unknown: '終了日未確認' },
};

/** One image treatment for the two home sections; failed images never leave a broken icon. */
export function HomeFamilyImage({ popup, small = false }: { popup?: PopupStore; small?: boolean }) {
  const { locale } = useLocale();
  const [failed, setFailed] = useState(false);
  const cover = popup ? popupCoverUrl(popup) : null;
  return cover && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cover}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={style.image}
    />
  ) : (
    <span className={style.placeholder}>
      <Store size={small ? 22 : 32} strokeWidth={1.4} aria-hidden />
      {!small && <span>{COPY[locale].pending}</span>}
    </span>
  );
}

/** Keep dates as supplied; an absent end date is not presented as an ongoing event. */
function shortDate(value?: string) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  return match ? `${match[2]}.${match[3]}` : value;
}

export function HomeFamilyCard({
  popup,
  wide = false,
  seen = false,
  wished = false,
  onOpen,
  onWish,
  onSkip,
}: {
  popup: PopupStore;
  wide?: boolean;
  seen?: boolean;
  wished?: boolean;
  onOpen: () => void;
  onWish?: () => void;
  onSkip?: () => void;
}) {
  const { t, locale } = useLocale();
  const copy = COPY[locale];
  const name = bilingual(
    popup.name,
    locale === 'en' ? popup.nameEn : locale === 'ja' ? popup.nameJa : null,
  );
  const place = bilingual(
    popup.location,
    locale === 'en' ? popup.locationEn : locale === 'ja' ? popup.locationJa : null,
  );
  const category = CATEGORIES.find((c) => c.code === classifyCategory(popup.category));
  const badge = popupBadge(popup.startDate, popup.endDate, kstTodayStart());
  const start = shortDate(popup.startDate);
  const end = shortDate(popup.endDate);
  return (
    <article
      className={`${style.card} ${style.cardWrap} ${wide ? style.wide : ''}`}
      data-popup-id={popup.id}
    >
      <button
        type="button"
        className={style.open}
        onClick={onOpen}
        title={name.display || popup.name}
      >
        <span className={style.media}>
          <HomeFamilyImage key={popupCoverUrl(popup)} popup={popup} />
          {badge && (
            <span className={style.badge}>
              {badge.kind === 'closingSoon'
                ? `${t('popall.badgeDday')}${badge.dday}`
                : badge.kind === 'openingToday'
                  ? t('popall.badgeToday')
                  : t('popall.badgeUpcoming')}
            </span>
          )}
          {seen && (
            <span className={style.seen}>
              <span>{t('popall.seenPill')}</span>
            </span>
          )}
          {isPexelsPhoto(popup) && (
            <span className={style.disclosure}>{t('photo.styledTooltip')}</span>
          )}
        </span>
        <span className={style.copy}>
          {!wide && (
            <span className={style.category}>
              {category ? localizedLabel(category, locale) : popup.category}
            </span>
          )}
          <strong className={style.name}>{name.display || popup.name}</strong>
          {name.original && <span className="sr-only">{name.original}</span>}
          <span className={style.place} title={place.display || popup.location}>
            {place.display || popup.location}
          </span>
          <span className={style.date}>
            <span>
              {start}
              {end ? ' — ' : ''}
              {end || `${start ? ' · ' : ''}${copy.unknown}`}
            </span>
          </span>
        </span>
      </button>
      {onWish && (
        <button
          type="button"
          className={style.wish}
          aria-label={t('misc.cardWish')}
          aria-pressed={wished}
          onClick={onWish}
        >
          <Heart size={21} fill={wished ? 'currentColor' : 'none'} aria-hidden />
        </button>
      )}
      {onSkip && (
        <button type="button" className={style.skip} onClick={onSkip}>
          <span>{copy.next}</span>
          <ArrowRight size={16} aria-hidden />
        </button>
      )}
    </article>
  );
}
