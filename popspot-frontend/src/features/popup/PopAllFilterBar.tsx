'use client';

import type { RefObject } from 'react';
import { Search, X } from 'lucide-react';
import type { PopAllQuery, PopAllSort } from '@/lib/popAllQuery';
import { CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { REGIONS, type RegionCode } from '@/lib/regions';
import { localizedLabel, useLocale, type MessageKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const SORTS: { value: PopAllSort; key: MessageKey }[] = [
  { value: 'latest', key: 'popall.sortLatest' },
  { value: 'deadline', key: 'popall.sortDeadline' },
  { value: 'popular', key: 'popall.sortPopular' },
];

interface Props {
  query: PopAllQuery;
  /** 지금 조건에 맞는 곳 수. 필터를 걸 때마다 바뀐다. */
  total: number;
  searchRef: RefObject<HTMLInputElement | null>;
  /** 조건 일부를 바꾼다. 페이지 되돌리기는 부르는 쪽이 아니라 여기서 책임진다. */
  onChange: (patch: Partial<PopAllQuery>) => void;
}

/**
 * POP-ALL 모달의 조건 줄 — 검색 · 지역 · 분야 · 기간 · 정렬 · 결과 수.
 *
 * <p><b>지역과 분야는 네이티브 {@code select} 다.</b> 지역이 열세 개라 칩으로 늘어놓으면 조건
 * 줄이 화면 절반을 먹고, 모바일에서는 OS 가 제 몫의 고르기 UI 를 준다. 대신 <b>「그 밖의」 항목을
 * 손으로 넣는다</b> — {@code REGIONS}/{@code CATEGORIES} 배열에는 'other' 항목이 없어서 배열만
 * 돌면 그 조건을 고를 길이 아예 없다. 실측상 지역이 'other' 인 팝업이 43%(1,046곳 중 411곳)라,
 * 그 항목이 없으면 <b>절반 가까이가 지역 필터로는 닿지 않는 곳</b>이 된다.
 *
 * <p><b>조건이 바뀌면 언제나 첫 페이지로 돌아간다.</b> 3페이지를 보다가 필터를 걸면 결과가 한
 * 페이지로 줄 수 있는데, 그때 페이지 번호가 남아 있으면 사용자에게는 화면이 제멋대로 튄 것으로
 * 보인다({@link runPopAllQuery} 가 범위를 넘는 번호를 당겨 주긴 하지만, 그건 안전망이지 의도가
 * 아니다).
 */
export function PopAllFilterBar({ query, total, searchRef, onChange }: Props) {
  const { t, locale } = useLocale();
  const selectCls =
    'rounded-pill border border-[var(--color-border)] bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:border-lime-400 focus:outline-none';

  const toggleBadge = (value: 'closingSoon' | 'openingToday') =>
    onChange({ badge: query.badge === value ? null : value, page: 1 });

  return (
    <div className="mb-3 flex flex-col gap-2.5">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={searchRef}
          type="search"
          value={query.keyword}
          onChange={(e) => onChange({ keyword: e.target.value, page: 1 })}
          placeholder={t('popall.searchPlaceholder')}
          aria-label={t('popall.searchPlaceholder')}
          className="w-full rounded-pill border border-[var(--color-border)] bg-surface py-2 pl-9 pr-9 text-sm text-foreground focus:border-lime-400 focus:outline-none"
        />
        {query.keyword && (
          <button
            type="button"
            onClick={() => onChange({ keyword: '', page: 1 })}
            aria-label={t('popall.relaxKeyword')}
            className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-pill text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={query.region ?? ''}
          onChange={(e) =>
            onChange({ region: (e.target.value || null) as RegionCode | null, page: 1 })
          }
          aria-label={t('popall.allRegions')}
          className={selectCls}
        >
          <option value="">{t('popall.allRegions')}</option>
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {localizedLabel(r, locale)}
            </option>
          ))}
          {/* REGIONS 에 없는 유일한 유효 코드. 이게 빠지면 43%가 닿지 않는 곳이 된다. */}
          <option value="other">{t('popall.regionOther')}</option>
        </select>

        <select
          value={query.category ?? ''}
          onChange={(e) =>
            onChange({ category: (e.target.value || null) as CategoryCode | null, page: 1 })
          }
          aria-label={t('popall.allCategories')}
          className={selectCls}
        >
          <option value="">{t('popall.allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {localizedLabel(c, locale)}
            </option>
          ))}
          <option value="other">{t('popall.categoryOther')}</option>
        </select>

        {(
          [
            ['closingSoon', 'popall.filterClosingSoon'],
            ['openingToday', 'popall.filterOpeningToday'],
          ] as const
        ).map(([value, key]) => (
          <button
            key={value}
            type="button"
            aria-pressed={query.badge === value}
            onClick={() => toggleBadge(value)}
            className={cn(
              'rounded-pill border px-3 py-1.5 text-xs font-semibold transition',
              query.badge === value
                ? 'border-lime-400 bg-lime-300 text-ink-900'
                : 'border-[var(--color-border)] text-foreground hover:border-lime-400',
            )}
          >
            {t(key)}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-pill border border-[var(--color-border)] p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={query.sort === s.value}
                onClick={() => onChange({ sort: s.value, page: 1 })}
                className={cn(
                  'rounded-pill px-2.5 py-1 text-xs font-semibold transition',
                  query.sort === s.value
                    ? 'bg-foreground text-surface'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(s.key)}
              </button>
            ))}
          </div>
          {/* 결과 수 — 필터를 걸었는데 몇 곳인지 모르면 조건 줄이 깜깜이가 된다.
              aria-live 로 화면 낭독기에도 변화가 전달되게 한다. */}
          <span
            aria-live="polite"
            className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground"
          >
            {t('popall.resultPrefix')}
            {total.toLocaleString()}
            {t('popall.resultSuffix')}
          </span>
        </div>
      </div>
    </div>
  );
}
