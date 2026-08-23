'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, localizedLabel, type Locale, type MessageKey } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { REGIONS, type RegionCode } from '@/lib/regions';
import type { PopupStore } from '@/types/popup';
import { bucketByDay, closingCountsByDate, groupByRegion } from './dayBuckets';

/**
 * 요일 머리글. 모듈 상수라 훅을 쓸 수 없어 <b>키만 두고</b> 그리는 쪽에서 옮긴다.
 *
 * <p>순서 자체는 바꾸지 않는다 — 아래 격자가 {@code getDay()}(일요일=0)로 빈 칸을 채우기 때문에,
 * 월요일 시작 문화권에 맞춘다고 이 배열만 돌리면 날짜가 통째로 어긋난다.
 */
const WEEKDAY_KEYS: readonly MessageKey[] = [
  'pmodal.cal.sun',
  'pmodal.cal.mon',
  'pmodal.cal.tue',
  'pmodal.cal.wed',
  'pmodal.cal.thu',
  'pmodal.cal.fri',
  'pmodal.cal.sat',
];

/**
 * 지역 코드 → 화면 언어 표시명.
 *
 * <p>'other' 는 {@link REGIONS} 에 없다(슬라이스 카드를 만들지 않는 값이라 정의가 없다).
 * 그래서 그 하나만 사전에서 꺼낸다 — 코드 문자열 'other' 가 화면에 그대로 나오면 안 된다.
 */
function regionChipLabel(code: RegionCode, locale: Locale, t: (key: MessageKey) => string): string {
  const region = REGIONS.find((r) => r.code === code);
  return region ? localizedLabel(region, locale) : t('cal.regionOther');
}

/**
 * 월별 팝업 일정 캘린더 — <b>본문만</b>. 모달과 화면 양쪽이 이걸 쓴다.
 *
 * <p>예전에는 모달 안에만 있었다. 하단 메뉴에 '일정' 이 생기면서 같은 달력을 화면으로도 열게
 * 됐는데, 붙여 넣어 두 벌로 두면 한쪽만 고쳐지는 날이 반드시 온다.
 *
 * <p>로그인이 필요 없다 — 넘겨받은 팝업 전부를 달력에 놓을 뿐이라, 처음 온 사람에게도 내용이
 * 찬다. 찜·최근 본 것처럼 이력이 있어야 보이는 것들과 다른 성질이다.
 */
export function PopupCalendar({
  popups,
  onNavigate,
}: {
  popups: PopupStore[];
  /**
   * 팝업 상세로 떠날 때 부를 것. 모달은 이걸로 자기를 닫는다.
   *
   * <p>달력이 모달을 아는 대신 "떠난다" 는 사실만 알린다. 화면(일정 탭)에서는 닫을 것이
   * 없으므로 아무것도 넘기지 않는다 — 그래야 같은 달력이 두 곳에서 다 맞는다.
   */
  onNavigate?: () => void;
}) {
  const { t, locale } = useLocale();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  /** 펼친 지역. 처음에는 전부 접혀 있다 — 12덩어리 머리글만 보이는 것이 이 화면의 요약이다. */
  const [openRegion, setOpenRegion] = useState<RegionCode | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  /**
   * 연·월·일 표기는 사전으로 맞출 수 없어 {@link Intl.DateTimeFormat} 에 맡긴다.
   *
   * <p>'년/월' 을 접미사 키로 빼면 영어가 "2026 7" 이 된다 — 언어마다 순서 자체가 다르기 때문이다
   * (2026년 7월 · July 2026 · 2026年7月). 숫자를 조립하지 말고 언어별 서식을 그대로 쓴다.
   */
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(
        new Date(year, month, 1),
      ),
    [locale, year, month],
  );

  const formatDay = useCallback(
    (day: number) =>
      new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(
        new Date(year, month, day),
      ),
    [locale, year, month],
  );

  const days = useMemo<(number | null)[]>(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [year, month]);

  /** 날짜별 마감 수 — 격자에 적을 숫자. 목록이 바뀔 때만 다시 센다. */
  const closingByDate = useMemo(() => closingCountsByDate(popups), [popups]);

  const dateKey = useCallback(
    (day: number) =>
      `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    [year, month],
  );

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
    setOpenRegion(null);
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
    setOpenRegion(null);
  };

  const selectedKey = selectedDay ? dateKey(selectedDay) : null;
  const buckets = useMemo(
    () => (selectedKey ? bucketByDay(popups, selectedKey) : null),
    [popups, selectedKey],
  );
  const closingGroups = useMemo(() => (buckets ? groupByRegion(buckets.closing) : null), [buckets]);

  return (
    <div className="flex flex-col">
      <nav className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label={t('pmodal.cal.prevMonth')}
          className="size-9 inline-flex items-center justify-center rounded-pill hover:bg-foreground/5 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="font-bold text-lg text-foreground tabular-nums">{monthLabel}</span>
        <button
          type="button"
          onClick={handleNextMonth}
          aria-label={t('pmodal.cal.nextMonth')}
          className="size-9 inline-flex items-center justify-center rounded-pill hover:bg-foreground/5 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </nav>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {WEEKDAY_KEYS.map((key, i) => (
          <div
            key={key}
            className={cn(
              'text-xs font-bold py-1',
              i === 0 ? 'text-hot-400' : i === 6 ? 'text-lime-500' : 'text-muted-foreground',
            )}
          >
            {t(key)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        {days.map((day, idx) => {
          const closingCount = day ? (closingByDate.get(dateKey(day)) ?? 0) : 0;
          const isSelected = day === selectedDay;
          const dayOfWeek = idx % 7;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (!day) return;
                setSelectedDay(day);
                setOpenRegion(null);
              }}
              disabled={!day}
              aria-label={
                day
                  ? closingCount > 0
                    ? `${formatDay(day)} — ${t('cal.closing')} ${closingCount}${t('cal.countSuffix')}`
                    : formatDay(day)
                  : undefined
              }
              aria-pressed={isSelected}
              className={cn(
                'aspect-square flex flex-col items-center justify-center rounded-md transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !day && 'invisible cursor-default',
                day &&
                  !isSelected &&
                  'bg-cream-300 dark:bg-ink-800 hover:bg-cream-400 dark:hover:bg-ink-700',
                isSelected &&
                  'bg-ink-900 dark:bg-cream-200 text-cream-200 dark:text-ink-900 shadow-md',
              )}
            >
              <span
                className={cn(
                  'text-sm font-bold',
                  !isSelected &&
                    (dayOfWeek === 0
                      ? 'text-hot-400'
                      : dayOfWeek === 6
                        ? 'text-lime-500'
                        : 'text-foreground'),
                )}
              >
                {day}
              </span>
              {/* 점이 아니라 숫자다 — 마감 153곳인 날과 12곳인 날이 점으로는 똑같아 보인다.
                  aria-hidden 은 점에 있던 것을 그대로 가져온다: 뜻은 버튼의 aria-label 이 지고,
                  숫자는 눈으로 보는 쪽만 맡는다. 가리지 않으면 브라우즈 모드에서 맥락 없는
                  "153" 이 읽힌다. */}
              {day && closingCount > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 text-[10px] font-bold leading-none tabular-nums',
                    isSelected ? 'text-cream-200 dark:text-ink-900' : 'text-hot-500',
                  )}
                >
                  {closingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-[var(--color-border)] pt-4 max-h-[280px] overflow-y-auto custom-scrollbar">
        <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
          <span aria-hidden className="size-2 bg-lime-500 rounded-full animate-pulse" />
          {/* 날짜가 앞뒤 어디에 붙는지가 언어마다 달라(7월 28일 진행 팝업 · Pop-ups on July 28) 앞뒤를 나눠 둔다. */}
          {t('pmodal.cal.dayHeadPrefix')}
          {selectedDay ? formatDay(selectedDay) : ''}
          {t('pmodal.cal.dayHeadSuffix')}
        </h4>

        {/*
          진행 중까지 0 이어야 빈 날이다. 마감·오픈만 보고 판단하면 379곳이 문을 연 8월 31일 같은
          날에 "일정이 없습니다" 가 뜬다 — 세 덩어리로 나눈 순간 생기는 함정이다.
        */}
        {!buckets ||
        (buckets.closing.length === 0 &&
          buckets.opening.length === 0 &&
          buckets.runningCount === 0) ? (
          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-[var(--color-border-strong)] rounded-md">
            {t('pmodal.cal.empty')}
          </div>
        ) : (
          <div className="space-y-4">
            {buckets.closing.length > 0 && (
              <section>
                <h5 className="mb-2 text-xs font-bold text-hot-500">
                  {t('cal.closing')} {buckets.closing.length}
                  {t('cal.countSuffix')}
                </h5>
                {closingGroups ? (
                  <div className="flex flex-wrap gap-1.5">
                    {closingGroups.map((group) => (
                      <button
                        key={group.code}
                        type="button"
                        onClick={() =>
                          setOpenRegion((prev) => (prev === group.code ? null : group.code))
                        }
                        aria-expanded={openRegion === group.code}
                        className={cn(
                          'rounded-pill px-2.5 py-1 text-[11px] font-bold transition-colors',
                          openRegion === group.code
                            ? 'bg-ink-900 text-cream-200 dark:bg-cream-200 dark:text-ink-900'
                            : 'bg-cream-300 text-foreground hover:bg-cream-400 dark:bg-ink-800 dark:hover:bg-ink-700',
                        )}
                      >
                        {regionChipLabel(group.code, locale, t)} {group.popups.length}
                      </button>
                    ))}
                  </div>
                ) : (
                  <PopupRows
                    popups={buckets.closing}
                    locale={locale}
                    t={t}
                    onNavigate={onNavigate}
                  />
                )}
                {closingGroups && openRegion && (
                  <div className="mt-2">
                    <PopupRows
                      popups={closingGroups.find((g) => g.code === openRegion)?.popups ?? []}
                      locale={locale}
                      t={t}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
              </section>
            )}

            {buckets.opening.length > 0 && (
              <section>
                <h5 className="mb-2 text-xs font-bold text-lime-600 dark:text-lime-400">
                  {t('cal.opening')} {buckets.opening.length}
                  {t('cal.countSuffix')}
                </h5>
                {/* 오픈은 묶지 않는다 — 실측 최대가 하루 11곳이라 묶을 이유가 없다. */}
                <PopupRows popups={buckets.opening} locale={locale} t={t} onNavigate={onNavigate} />
              </section>
            )}

            {/*
              진행 중은 숫자 한 줄이고 링크가 없다. 500곳을 스크롤시키는 것은 정보가 아니라 벽이고,
              "지도에서 보기" 도 걸 수 없다 — 지도는 오늘 열려 있는 것을 보여줄 뿐 고른 날짜의
              목록을 재현하지 못한다. 누르면 다른 목록이 나오는 링크는 없느니만 못하다.
            */}
            {buckets.runningCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('cal.running')} {buckets.runningCount}
                {t('cal.countSuffix')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 팝업 한 줄 — 마감·오픈·펼친 지역이 같은 모양을 쓴다.
 *
 * <p>마크업은 예전 상세 영역의 것을 글자 그대로 옮긴 것이다. 세 곳이 같은 줄을 그리게 됐으니
 * 한 벌만 둔다 — 붙여 넣으면 한쪽만 고쳐지는 날이 온다.
 */
function PopupRows({
  popups,
  locale,
  t,
  onNavigate,
}: {
  popups: PopupStore[];
  locale: Locale;
  t: (key: MessageKey) => string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-2">
      {popups.map((popup) => (
        <Link
          href={localizedPath(`/popup/${popup.id}`, locale)}
          key={popup.id}
          onClick={onNavigate}
        >
          <article className="p-3 bg-cream-300 dark:bg-ink-800 rounded-md border border-[var(--color-border)] flex justify-between items-center hover:border-lime-300/60 transition-colors group cursor-pointer">
            <div className="min-w-0 flex-1">
              <h5 className="font-semibold text-sm text-foreground group-hover:text-lime-500 transition-colors truncate flex items-center gap-1.5">
                {popup.name}
                {/* [V4] 자동수집 정보임을 한눈에 알리는 뱃지 — 정확성 면책의 가시성 확보 */}
                {popup.sourceType === 'CRAWLED' && (
                  <span
                    title={t('pmodal.cal.aiBadgeTip')}
                    className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-pill"
                  >
                    <Sparkles className="size-2.5" aria-hidden />
                    AI
                  </span>
                )}
              </h5>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{popup.location}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 bg-surface border border-[var(--color-border)] text-foreground rounded-pill shrink-0 ml-3 group-hover:bg-lime-300 group-hover:text-ink-900 group-hover:border-lime-300 transition-colors">
              {t('pmodal.cal.detail')}
            </span>
          </article>
        </Link>
      ))}
    </div>
  );
}
