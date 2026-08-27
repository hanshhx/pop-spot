'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PopupCard } from '@/components/main/PopupCard';
import { PopAllFilterBar } from '@/features/popup/PopAllFilterBar';
import { PopAllRecentPanel } from '@/features/popup/PopAllRecentPanel';
import { useHistoryBackedModal } from '@/features/popup/useHistoryBackedModal';
import {
  EMPTY_POP_ALL_QUERY,
  runPopAllQuery,
  type PopAllQuery,
  type RelaxSuggestion,
} from '@/lib/popAllQuery';
import { kstTodayStart, type CategoryCode } from '@/lib/popupSlices';
import { readVisits } from '@/lib/recentVisits';
import { saveHomeReturnState } from '@/lib/homeReturnScroll';
import { localizedPath } from '@/lib/localePath';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PopupStore } from '@/types/popup';

const RELAX_LABEL: Record<RelaxSuggestion['field'], MessageKey> = {
  keyword: 'popall.relaxKeyword',
  region: 'popall.relaxRegion',
  category: 'popall.relaxCategory',
  badge: 'popall.relaxBadge',
};

/**
 * 조건 하나를 푸는 패치.
 *
 * <p>{@code keyword} 만 빈 문자열이고 나머지 셋은 null 이다. 이 갈래를 한 곳에 모아 두지 않으면
 * 부르는 자리마다 각자 틀린다.
 */
function relaxPatch(field: RelaxSuggestion['field']): Partial<PopAllQuery> {
  return field === 'keyword' ? { keyword: '', page: 1 } : { [field]: null, page: 1 };
}

/**
 * 페이지 번호 줄에 실제로 그릴 것들 — 처음·끝과 현재 주변만, 사이는 생략 표시.
 *
 * <p>전체가 39페이지인데 서른아홉 개를 다 그리면 그 줄이 화면을 먹는다.
 *
 * <p><b>한 칸만 비면 접지 않는다.</b> 번호 하나를 「…」로 바꾸면 차지하는 자리는 그대로인데
 * 누를 수 있는 것만 하나 줄어든다 — 접는 이유가 자리를 아끼는 것이므로, 아껴지지 않으면
 * 접을 이유도 없다.
 */
export function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const shown = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  shown.forEach((p, i) => {
    if (i > 0) {
      const gapSize = p - shown[i - 1] - 1;
      if (gapSize === 1) out.push(p - 1);
      else if (gapSize > 1) out.push('gap');
    }
    out.push(p);
  });
  return out;
}

export interface PopAllModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 보여줄 목록 전부. 이미 만료·중복이 걸러진 것을 받는다. */
  popups: PopupStore[];
  /** 열 때 미리 걸어 둘 분야. 미리보기의 줄 제목에서 들어오면 채워진다. */
  initialCategory?: CategoryCode | null;
}

/**
 * POP-ALL 전체 보기 — 검색 · 필터 · 정렬 · 페이지네이션 · 최근 본 팝업이 있는 큰 모달.
 *
 * <p><b>왜 페이지가 아니라 모달인가.</b> 홈에서 훑다가 들어오는 자리라, 페이지로 나가면 돌아올 때
 * 홈의 스크롤 위치와 열려 있던 탭을 잃는다. 모달이면 배경이 그대로 있다. 대신 모바일 뒤로가기가
 * 사이트를 떠나지 않도록 history 항목을 하나 쌓는다({@link useHistoryBackedModal}).
 *
 * <p><b>서버를 부르지 않는다.</b> 홈이 이미 목록 전체를 메모리에 들고 있어서, 타이핑할 때마다
 * 즉시 결과가 나온다 — 디바운스도 로딩 상태도 없다. 빈 결과일 때 "지역만 빼면 53곳" 같은 안내를
 * 실제로 세어서 줄 수 있는 것도 같은 이유다({@link runPopAllQuery}).
 */
export function PopAllModal({ open, onOpenChange, popups, initialCategory }: PopAllModalProps) {
  const { t } = useLocale();
  const { onOpenChange: handleOpenChange, notifyNavigatingAway } = useHistoryBackedModal(
    open,
    onOpenChange,
  );

  /*
   * 열릴 때마다 1씩 오르는 번호. {@link PopAllBody} 의 key 로 써서 <b>새로 마운트되게</b> 한다.
   *
   * <p>처음엔 이게 필요 없다고 봤다 — Radix 포털이 닫힐 때 내용을 언마운트하니 다시 열면 알아서
   * 새 컴포넌트일 거라고. <b>틀렸다.</b> Radix 는 닫는 애니메이션이 끝나야 언마운트하는데 그
   * 애니메이션은 requestAnimationFrame 으로 돌고, 브라우저 탭이 숨겨지면 rAF 가 멈춘다. 실제로
   * 조건을 걸고 닫았다 다시 여니 지역·정렬이 그대로 남아 있었다.
   *
   * <p>그래서 언마운트 시점을 남의 애니메이션에 맡기지 않고 key 로 직접 정한다. 아래는 React 가
   * 문서화한 "prop 이 바뀔 때 state 를 조정하는" 렌더 중 갱신 패턴이다 — effect 보다 한 렌더
   * 빠르고, 언제 다시 읽어야 하는지를 손으로 관리하지 않아도 된다.
   */
  const [prevOpen, setPrevOpen] = useState(open);
  const [openSeq, setOpenSeq] = useState(0);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setOpenSeq((s) => s + 1);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* size="full" 이 95vw x 90vh 를 준다. overflow 는 여기서 잠그고 격자만 스크롤시킨다 —
          통째로 스크롤되면 조건 줄과 페이지 줄이 같이 밀려 올라가 손이 닿지 않는다. */}
      <DialogContent size="full" className="flex flex-col overflow-hidden p-4 md:p-6">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-baseline gap-2 text-xl font-black md:text-2xl">
            {t('popall.title')}
            <span className="text-sm font-bold text-muted-foreground">{t('popall.tagline')}</span>
          </DialogTitle>
          <DialogDescription>{t('popall.modalDesc')}</DialogDescription>
        </DialogHeader>
        <PopAllBody
          key={openSeq}
          popups={popups}
          initialCategory={initialCategory}
          onClose={() => onOpenChange(false)}
          onNavigateAway={notifyNavigatingAway}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * 모달 내용 — 조건 줄 · 격자 · 페이지 줄 · 최근 본 팝업.
 *
 * <p><b>왜 껍데기와 나눠 놓았나.</b> 이 안의 상태는 모달을 열 때마다 처음부터여야 한다. 지난번
 * 필터가 남아 있으면 「전체 보기」를 눌렀는데 43곳만 나오고, 「이미 본 곳」이 낡아 있으면 방금
 * 본 팝업이 안 흐리다. 그걸 effect 로 되돌릴 수도 있지만, <b>Radix 포털은 열릴 때 비로소
 * 내용을 마운트한다</b> — 즉 이 컴포넌트는 열 때마다 새로 태어난다. 그러면 초기화가 코드가
 * 아니라 구조가 되어, 나중에 상태를 하나 더 늘려도 되돌리기를 빠뜨릴 수가 없다.
 *
 * <p>그래서 여기에는 {@code useEffect} 가 하나도 없다. localStorage 읽기는 {@code useState} 의
 * 지연 초기화로 마운트 때 한 번 일어나고, {@link readVisits} 는 서버에서 빈 배열을 돌려주므로
 * 안전하다.
 */
function PopAllBody({
  popups,
  initialCategory,
  onClose,
  onNavigateAway,
}: {
  popups: PopupStore[];
  initialCategory?: CategoryCode | null;
  onClose: () => void;
  onNavigateAway: () => void;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const reduce = useReducedMotion();
  // 페이지 앞뒤 버튼의 낭독기 이름. 사전에 넣을 만큼 재사용되지 않는 두 낱말이라
  // dialog.tsx 의 닫기 버튼과 같은 방식으로 여기서 고른다.
  const prevLabel =
    locale === 'en' ? 'Previous page' : locale === 'ja' ? '前のページ' : '이전 페이지';
  const nextLabel = locale === 'en' ? 'Next page' : locale === 'ja' ? '次のページ' : '다음 페이지';
  const searchRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState<PopAllQuery>(() => ({
    ...EMPTY_POP_ALL_QUERY,
    category: initialCategory ?? null,
  }));
  const [seenIds] = useState<ReadonlySet<number>>(
    () => new Set(readVisits().map((v) => v.popupId)),
  );

  const today = useMemo(() => kstTodayStart(), []);
  const result = useMemo(() => runPopAllQuery(popups, query, today), [popups, query, today]);
  const patch = useCallback((p: Partial<PopAllQuery>) => setQuery((q) => ({ ...q, ...p })), []);

  /*
   * 격자에 AnimatePresence 를 쓰지 않는다.
   *
   * <p>처음엔 {@code mode="wait"} 로 페이지가 바뀔 때 옛 격자가 사라진 뒤 새 격자가 들어오게
   * 했는데, 그 방식은 <b>나가는 애니메이션이 끝나야</b> 새 것을 마운트한다. framer-motion 은
   * requestAnimationFrame 으로 도는데 <b>브라우저 탭이 숨겨지면 rAF 가 완전히 멈춘다</b>
   * (실측: 숨은 탭에서 1초간 0회). 페이지를 넘긴 직후 다른 탭으로 갔다가 돌아오면 끝나지 않을
   * 애니메이션을 기다리느라 격자가 빈 채로 멈춘다 — 실제로 그 상태를 재현했다.
   *
   * <p>key 가 바뀌면 어차피 리마운트되므로 나가는 단계는 애초에 필요가 없었다. 칸별 stagger
   * 만으로 충분히 흐르는 느낌이 나고, 멈출 곳이 사라진다.
   */
  const goPage = useCallback(
    (p: number) => {
      patch({ page: p });
      // 페이지를 바꾸면 격자를 맨 위로 — 안 그러면 다음 페이지가 중간부터 보인다.
      gridRef.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    },
    [patch, reduce],
  );

  /*
   * 카드를 누르는 것은 "닫는 것" 이 아니라 "떠나는 것" 이다. history 항목을 back() 으로 소비하지
   * 않고 router.replace 로 같은 항목을 상세 URL 로 바꿔치기한다 — 그래야 상세에서 뒤로 한 번이면
   * 이 목록이 다시 열리지 않고 곧장 홈으로 돌아간다.
   */
  const goDetail = useCallback(
    (id: number) => {
      onNavigateAway();
      saveHomeReturnState();
      onClose();
      router.replace(localizedPath(`/popup/${id}`, locale));
    },
    [onNavigateAway, onClose, router, locale],
  );

  return (
    <>
      <PopAllFilterBar query={query} total={result.total} searchRef={searchRef} onChange={patch} />

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={gridRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
            {result.total === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <SearchX size={30} className="text-muted-foreground" aria-hidden />
                <p className="text-sm font-bold text-foreground">{t('popall.emptyTitle')}</p>
                {/* 「결과 없음」만 띄우면 막다른 길이다. 목록이 통째로 메모리에 있으니 조건을
                    하나씩 풀어 본 결과를 실제로 세어서 알려줄 수 있다 — 추측이 아니라 사실이다. */}
                <div className="flex flex-wrap justify-center gap-2">
                  {result.relaxSuggestions.map((s) => (
                    <button
                      key={s.field}
                      type="button"
                      onClick={() => patch(relaxPatch(s.field))}
                      className="rounded-pill border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-lime-400 hover:bg-lime-300/10"
                    >
                      {t(RELAX_LABEL[s.field])} ({s.count.toLocaleString()}
                      {t('popall.resultSuffix')})
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuery({ ...EMPTY_POP_ALL_QUERY })}
                    className="rounded-pill bg-lime-300 px-3 py-1.5 text-xs font-black text-ink-900 transition hover:brightness-105"
                  >
                    {t('popall.resetAll')}
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={`${result.page}-${query.sort}-${query.keyword}-${query.region}-${query.category}-${query.badge}`}
                className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              >
                {result.items.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.28,
                      // 스물넉 장을 차례로 밀면 마지막이 0.6초 뒤에 나타난다. 열두 장에서
                      // 끊으면 흐르는 느낌은 남고 기다림은 사라진다.
                      delay: reduce ? 0 : Math.min(i, 12) * 0.025,
                      ease: 'easeOut',
                    }}
                  >
                    <PopupCard
                      popup={p}
                      seen={seenIds.has(p.id)}
                      className="w-full"
                      onClick={() => goDetail(p.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {result.totalPages > 1 && (
            <nav
              aria-label={t('popall.title')}
              className="mt-2 flex shrink-0 items-center justify-center gap-1 pt-1"
            >
              <button
                type="button"
                disabled={result.page <= 1}
                onClick={() => goPage(result.page - 1)}
                className="grid size-8 place-items-center rounded-pill text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                aria-label={prevLabel}
              >
                <ChevronLeft size={16} />
              </button>
              {pageWindow(result.page, result.totalPages).map((p, i) =>
                p === 'gap' ? (
                  <span key={`gap${i}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    aria-current={p === result.page ? 'page' : undefined}
                    onClick={() => goPage(p)}
                    className={cn(
                      'min-w-8 rounded-pill px-2 py-1 text-xs font-bold tabular-nums transition',
                      p === result.page
                        ? 'bg-foreground text-surface'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                    )}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={result.page >= result.totalPages}
                onClick={() => goPage(result.page + 1)}
                className="grid size-8 place-items-center rounded-pill text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                aria-label={nextLabel}
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </div>

        <PopAllRecentPanel onOpenPopup={goDetail} />
      </div>
    </>
  );
}
