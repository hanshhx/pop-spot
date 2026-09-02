'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { daysUntilStart, featuredForPage } from '@/lib/featuredBanner';
import { useLocale } from '@/lib/i18n';

/**
 * 홈 맨 위 한 줄짜리 주목 팝업 배너.
 *
 * <p><b>왜 얇은가.</b> 여기는 사이트가 자기를 소개하는 자리다("오늘 서울에 N곳"). 제휴 건이
 * 그 위에 커다랗게 앉으면 홈이 광고판처럼 읽힌다. 한 줄이면 맨 위에 있어도 자기 소개를
 * 화면 밖으로 밀지 않는다 — 특히 좁은 화면에서.
 *
 * <p><b>왜 그림 비율이 3:4 인가.</b> 포스터를 정사각형으로 자르면 아래쪽 제목이 잘려 무슨
 * 행사인지 알 수 없는 무늬가 된다. 원래 비율대로 두면 작아도 포스터로 읽힌다.
 *
 * <p>띄울지 말지는 {@link featuredForPage} 가 정한다 — 끝난 다음 날 저절로 사라진다.
 *
 * <p><b>홈·랜딩·상세 어디에나 같은 배너가 뜬다.</b> 다만 이 배너가 가리키는 팝업의 상세에서는
 * 안 뜬다 — 이미 그 화면에 와 있는 사람에게 같은 곳으로 가라고 권하면, 눌러도 화면이 안 바뀌어
 * 링크가 죽은 것으로 보인다. 그 화면은 {@code hideOnPopupId} 로 자기 id 를 알려 준다.
 */
export function FeaturedPopupBanner({
  hideOnPopupId,
}: {
  /** 지금 보고 있는 팝업 id. 이 배너가 가리키는 팝업과 같으면 안 띄운다. */
  hideOnPopupId?: number | string | null;
} = {}) {
  const { t } = useLocale();

  const featured = featuredForPage(hideOnPopupId);
  if (!featured) return null;

  const untilStart = daysUntilStart(featured, new Date());
  const badge = untilStart === null ? t('featured.ongoing') : `D-${untilStart}`;

  return (
    <Link
      href={`/popup/${featured.popupId}`}
      className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 transition hover:border-lime-300 hover:shadow-sm dark:border-white/10 dark:bg-[#1c1c1e] dark:hover:border-lime-400/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 이미 webp 로 줄여 public/ 에 둔 자료라 런타임 변환이 할 일이 없다(인프라 비용 0원 제약) */}
      <img
        src={featured.imageUrl}
        alt=""
        aria-hidden
        className="h-16 w-12 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-black tracking-wide">
          <span className="rounded-pill bg-lime-300 px-2 py-0.5 text-ink-900">{badge}</span>
          <span className="text-muted-foreground">{t('featured.eyebrow')}</span>
        </p>
        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{featured.title}</p>
        <p className="truncate text-xs text-muted-foreground">{featured.place}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
