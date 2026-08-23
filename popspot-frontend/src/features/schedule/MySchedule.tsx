'use client';

import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';

import { addToCalendar, toCalendarEvent } from '@/lib/calendar';
import { ddayBadge } from '@/lib/dday';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { bilingual } from '@/lib/bilingual';
import type { PopupStore } from '@/types/popup';
import { useMySchedule } from './useMySchedule';

/**
 * 내가 본 팝업 중 진행 중인 것 — 마감일 순.
 *
 * <p>일정 탭이 홈의 캘린더 모달과 <b>같은 컴포넌트</b>를 열고 있었다. 같은 것을 두 곳에서 열 수
 * 있게 된 것뿐이면 핵심 네 칸 중 하나를 쓸 이유가 없다. 달력이 "무엇이 열려 있나" 에 답한다면
 * 이 블록은 <b>"내가 관심 뒀던 것이 언제 사라지나"</b> 에 답한다.
 *
 * <p>기록이 없으면 <b>아무것도 그리지 않는다.</b> 유입의 93%가 검색으로 들어와 이력이 없는
 * 사람들이라, 그들에게 빈 칸을 보여주면 동행이 비어 있던 자리를 또 빈 화면으로 채우는 셈이 된다.
 */
export function MySchedule({ popups }: { popups: PopupStore[] }) {
  const { t, locale } = useLocale();
  const mine = useMySchedule(popups);

  if (mine.length === 0) return null;

  return (
    <section className="mb-6 border-b border-[var(--color-border)] pb-6">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground lg:text-lg">
        {t('sched.mineTitle')}
      </h3>

      <ul className="space-y-2">
        {mine.map((popup) => {
          const dday = ddayBadge(popup.endDate);
          const shownName = bilingual(
            popup.name,
            locale === 'en' ? popup.nameEn : locale === 'ja' ? popup.nameJa : null,
          );
          // 날짜가 정확히 YYYY-MM-DD 가 아니면 null 이다. 지어낸 일정을 남의 달력에 넣는 것은
          // 정보가 없는 것보다 나쁘므로, null 이면 버튼 자체를 그리지 않는다.
          const canSave = toCalendarEvent(popup) !== null;

          return (
            <li
              key={popup.id}
              className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-cream-300 p-3 dark:bg-ink-800"
            >
              {dday && (
                <span className="shrink-0 rounded-pill bg-lime-300 px-2 py-1 text-[11px] font-bold text-ink-900 tabular-nums">
                  {dday.labelKey
                    ? t(dday.labelKey)
                    : `${t('misc.cardDdayPrefix')}${dday.days}${t('misc.cardDdaySuffix')}`}
                </span>
              )}

              <Link
                href={localizedPath(`/popup/${popup.id}`, locale)}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground hover:text-lime-500"
              >
                {shownName.display || popup.name}
              </Link>

              {canSave && (
                <button
                  type="button"
                  // addToCalendar 는 window.open 을 부른다 — onClick 안에서만 안전하다.
                  // 데스크톱·안드로이드에서는 팝업 차단기를 무시하고 true 를 돌려주므로,
                  // 돌려받은 값으로 "저장됨" 을 알리지 않는다.
                  onClick={() => addToCalendar(popup)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-pill border border-[var(--color-border)] bg-surface px-2.5 py-1 text-[11px] font-bold text-foreground transition-colors hover:bg-lime-300 hover:text-ink-900"
                >
                  <CalendarPlus className="size-3" aria-hidden />
                  {t('sched.save')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default MySchedule;
