'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { clearVisits, readVisits, type RecentVisit } from '@/lib/recentVisits';
import { useLocale } from '@/lib/i18n';

/** 패널이 보여줄 최대 개수. 기록 자체는 무제한으로 쌓인다({@link recentVisits}). */
const PANEL_LIMIT = 12;

/**
 * POP-ALL 모달 오른쪽의 「최근 본 팝업」.
 *
 * <p>몇백 곳을 훑는 화면에서 <b>왔던 자리를 잃지 않게</b> 하는 것이 이 패널의 일이다. 필터를
 * 바꾸고 페이지를 넘기다 보면 방금 열어 본 팝업을 다시 찾기 어려운데, 여기 남아 있으면 한 번에
 * 돌아간다. 격자의 흐린 카드(이미 본 곳)와 짝이다 — 그쪽이 "이건 봤다" 를 말하고 이쪽이
 * "무엇을 봤는지" 를 말한다.
 *
 * <p><b>사진을 넣지 않는다.</b> 기록에 담기는 것은 이름과 사진 주소뿐이라 그 사진이 실제 현장
 * 사진인지 Pexels 연출 이미지인지 알 수 없다. 이 사이트는 연출 이미지에 반드시 고지를 붙이는데,
 * 구분할 수 없으면 고지를 붙일 수도 뗄 수도 없다 — 모르는 것을 아는 척하는 대신 이름으로 간다.
 * 이 패널이 답해야 하는 질문("내가 뭘 봤더라")에는 이름이면 충분하다.
 */
export function PopAllRecentPanel({ onOpenPopup }: { onOpenPopup: (id: number) => void }) {
  const { t, locale } = useLocale();

  /*
   * 마운트 때 한 번만 읽는다 — <b>effect 가 아니라 지연 초기화로</b>.
   *
   * <p>이 패널은 Radix 포털 안에 있어서 모달이 열릴 때 비로소 마운트되고 닫히면 사라진다. 즉
   * "열 때마다 다시 읽기" 가 곧 "마운트 때 한 번 읽기" 다. effect 로 같은 일을 하면 렌더가 한
   * 번 더 돌고, 무엇보다 <b>언제 다시 읽어야 하는지를 손으로 관리하게 된다</b>.
   *
   * <p>{@link readVisits} 는 서버에서 빈 배열을 돌려주므로 렌더 중에 불러도 안전하다.
   */
  const [visits, setVisits] = useState<RecentVisit[]>(() => readVisits().slice(0, PANEL_LIMIT));

  const fmt = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : locale, {
    month: 'numeric',
    day: 'numeric',
  });

  return (
    <aside className="hidden w-56 shrink-0 flex-col lg:flex">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-black text-foreground">
          <History size={15} className="text-lime-600 dark:text-lime-300" />
          {t('popall.recentTitle')}
        </h4>
        {visits.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearVisits();
              setVisits([]);
            }}
            className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {t('popall.recentClear')}
          </button>
        )}
      </header>

      {visits.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          {t('popall.recentEmpty')}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {visits.map((v) => (
            <li key={v.popupId}>
              <button
                type="button"
                onClick={() => onOpenPopup(v.popupId)}
                className="flex w-full items-baseline gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-foreground/5"
              >
                <span className="line-clamp-2 flex-1 text-[11px] font-semibold leading-snug text-foreground">
                  {v.popupName}
                </span>
                <time
                  dateTime={v.visitedAt}
                  className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                >
                  {fmt.format(new Date(v.visitedAt))}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
