'use client';

import { useMemo, useState } from 'react';
import { SearchX, X } from 'lucide-react';

import { PopupCard } from '@/components/main/PopupCard';
import {
  DISCOVER_CARD_LIMIT,
  categoryOptions,
  discoverResult,
  regionOptions,
} from '@/lib/discoverOptions';
import { clearSkipped, skipPopup, useSkipped } from '@/lib/discoverySkips';
import { localizedLabel, useLocale, type MessageKey } from '@/lib/i18n';
import { notifyError } from '@/lib/notify';
import { CATEGORIES, kstTodayStart, type CategoryCode } from '@/lib/popupSlices';
import { REGIONS, type RegionCode } from '@/lib/regions';
import type { PopupStore } from '@/types/popup';

/**
 * 취향 탐색 — 지역·분야를 고르면 갈 만한 곳을 최대 6곳 보여준다.
 *
 * <p><b>선택지는 재고가 있는 것만 그린다</b>({@link regionOptions}·{@link categoryOptions}).
 * {@code CATEGORIES} 를 그냥 나열하면 {@code lifestyle} 처럼 <b>고를 수는 있는데 항상 빈손인</b>
 * 선택지가 생긴다. 두 축이 서로를 좁히므로 고를 수 있는 조합에는 언제나 재고가 있다.
 *
 * <p><b>서버를 부르지 않는다.</b> 홈이 이미 들고 있는 목록을 받아 메모리에서 거른다 —
 * {@code GET /api/popups/{id}} 는 조회수를 올리고 YouTube 를 부르는 <b>쓰기</b>라 목록 화면에서
 * 부르면 안 된다.
 *
 * <p><b>'넘기기' 는 이번 탐색에서만이다</b>({@code discoverySkips} 는 sessionStorage 를 쓴다).
 * 기획 §4.4 — "영구 취향으로 단정하지 않는다."
 *
 * <p><b>카드 밀도는 POP-ALL 결과 그리드와 맞춘다</b>(최대 5열). 3열까지만 두면 넓은 화면에서
 * 한 장이 지나치게 커져, 여섯 장을 훑어보는 화면이 아니라 여섯 장을 스크롤하는 화면이 된다.
 *
 * <p>빈손일 때 "조건을 완화하세요" 를 말하려면 <b>왜 비었는지</b>부터 갈라야 한다. 재고가 없는
 * 것과 자기가 다 넘긴 것은 다른 상황이고, 뭉뚱그리면 조건이 멀쩡한 사람에게 조건을 고치라고
 * 말하게 된다.
 */

interface Props {
  /** 홈이 이미 들고 있는 전체 목록. 이 컴포넌트는 서버를 부르지 않는다. */
  popups: PopupStore[];
  wishedIds: ReadonlySet<number>;
  /** 찜 담기/빼기. 회원·비회원 갈래는 부르는 쪽이 안다. */
  onWish: (popupId: number) => void;
  onOpenPopup: (popupId: number) => void;
}

const RELAX_LABEL: Record<'keyword' | 'region' | 'category' | 'badge', MessageKey> = {
  keyword: 'popall.relaxKeyword',
  region: 'popall.relaxRegion',
  category: 'popall.relaxCategory',
  badge: 'popall.relaxBadge',
};

export function DiscoverPicker({ popups, wishedIds, onWish, onOpenPopup }: Props) {
  const { t, locale } = useLocale();
  const [region, setRegion] = useState<RegionCode | null>(null);
  const [category, setCategory] = useState<CategoryCode | null>(null);
  const skipped = useSkipped();

  // 렌더마다 새 Date 를 만들면 아래 useMemo 가 매번 다시 돈다.
  const today = useMemo(() => kstTodayStart(), []);

  const regions = useMemo(() => regionOptions(popups, category, today), [popups, category, today]);
  const categories = useMemo(() => categoryOptions(popups, region, today), [popups, region, today]);
  const result = useMemo(
    () => discoverResult(popups, region, category, skipped, today),
    [popups, region, category, skipped, today],
  );

  const regionLabel = (code: RegionCode) => {
    const def = REGIONS.find((r) => r.code === code);
    return def ? localizedLabel(def, locale) : t('popall.regionOther');
  };
  const categoryLabelOf = (code: CategoryCode) => {
    const def = CATEGORIES.find((c) => c.code === code);
    return def ? localizedLabel(def, locale) : t('popall.categoryOther');
  };

  const handleSkip = (popupId: number) => {
    const r = skipPopup(popupId);
    // 저장이 확인되지 않으면 넘겨진 것처럼 보이게 두지 않는다 — 새로고침하면 되돌아온다.
    if (!r.saved) notifyError(t('discover.notSaved'));
  };

  const selectCls =
    'rounded-pill border border-[var(--color-border)] bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:border-lime-400 focus:outline-none';

  return (
    <section className="mb-10" aria-label={t('discover.title')}>
      <h3 className="text-xl font-black tracking-tight text-foreground md:text-2xl">
        {t('discover.title')}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground md:text-sm">{t('discover.desc')}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={region ?? ''}
          onChange={(e) => setRegion((e.target.value || null) as RegionCode | null)}
          aria-label={t('popall.allRegions')}
          className={selectCls}
        >
          <option value="">{t('popall.allRegions')}</option>
          {regions.map((o) => (
            <option key={o.value} value={o.value}>
              {regionLabel(o.value)} ({o.count})
            </option>
          ))}
        </select>

        <select
          value={category ?? ''}
          onChange={(e) => setCategory((e.target.value || null) as CategoryCode | null)}
          aria-label={t('popall.allCategories')}
          className={selectCls}
        >
          <option value="">{t('popall.allCategories')}</option>
          {categories.map((o) => (
            <option key={o.value} value={o.value}>
              {categoryLabelOf(o.value)} ({o.count})
            </option>
          ))}
        </select>
      </div>

      {result.emptiness === 'none' ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {result.items.slice(0, DISCOVER_CARD_LIMIT).map((popup) => (
            <div key={popup.id} className="flex flex-col gap-1.5">
              <PopupCard
                popup={popup}
                wished={wishedIds.has(Number(popup.id))}
                onWish={() => onWish(Number(popup.id))}
                onClick={() => onOpenPopup(Number(popup.id))}
              />
              {/*
                넘기기는 카드 <b>밖</b>에 둔다. 사진 위 우상단은 하트가 이미 쓰고 있고, 거기에
                버튼을 하나 더 얹으면 2026-09-06 의 겹침 사고와 같은 모양이 된다.
              */}
              <button
                type="button"
                onClick={() => handleSkip(Number(popup.id))}
                className="inline-flex min-h-8 items-center justify-center gap-1 rounded-pill border border-[var(--color-border)] px-2 text-[11px] font-semibold text-muted-foreground transition hover:border-[var(--color-border-strong)] hover:text-foreground"
              >
                <X size={12} aria-hidden />
                {t('discover.skip')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-md border border-dashed border-[var(--color-border-strong)] px-3 py-10 text-center">
          <SearchX size={26} className="text-muted-foreground" aria-hidden />
          <p className="text-sm font-bold text-foreground">
            {result.emptiness === 'all-skipped' ? t('discover.allSkipped') : t('popall.emptyTitle')}
          </p>

          {result.emptiness === 'all-skipped' ? (
            <>
              <p className="text-xs text-muted-foreground">{t('discover.allSkippedHint')}</p>
              <button
                type="button"
                onClick={() => clearSkipped()}
                className="min-h-11 rounded-pill bg-lime-300 px-4 text-xs font-black text-ink-900 transition hover:brightness-105"
              >
                {t('discover.undoSkips')}
              </button>
            </>
          ) : (
            // 조건을 하나씩 풀어 실제로 세어 본 결과만 제안한다. 풀어도 0인 것은 오지 않는다.
            <div className="flex flex-wrap justify-center gap-2">
              {result.relaxSuggestions.map((s) => (
                <button
                  key={s.field}
                  type="button"
                  onClick={() => {
                    if (s.field === 'region') setRegion(null);
                    if (s.field === 'category') setCategory(null);
                  }}
                  className="min-h-11 rounded-pill border border-[var(--color-border)] px-3 text-xs font-bold text-foreground transition hover:border-lime-400 hover:bg-lime-300/10"
                >
                  {t(RELAX_LABEL[s.field])} ({s.count.toLocaleString()}
                  {t('popall.resultSuffix')})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
