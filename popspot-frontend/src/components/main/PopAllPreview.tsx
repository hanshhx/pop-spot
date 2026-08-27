'use client';

import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PreviewRow } from '@/lib/popAllPreview';
import { isPexelsPhoto, popupCoverUrl } from '@/lib/popupCover';
import { categoryVisual } from '@/components/main/categoryVisual';
import { CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { bilingual } from '@/lib/bilingual';
import { localizedLabel, useLocale, type Locale } from '@/lib/i18n';

/**
 * POP-ALL 미리보기 — 홈의 독립 섹션.
 *
 * <p><b>왜 이 모양인가.</b> 홈에는 팝업을 보여주는 자리가 셋이다. POP-LOOK 은 대표 하나 + 목록
 * 일곱의 <i>랭킹</i>이고, 「최근 오픈한 팝업」은 한 줄짜리 가로 <i>레일</i>이다. 셋째 자리가 또
 * 목록이면 같은 화면이 세 번 나온다. 그래서 여기는 <b>카테고리마다 한 줄</b>인 격자다 — 형태가
 * 다르고, 하는 말도 다르다. 앞의 둘이 "이게 인기다 / 이게 새것이다" 라고 말한다면 여기는
 * <b>"이만큼 다양하다"</b> 를 말한다. 주장이 아니라 눈으로.
 *
 * <p>줄 제목을 누르면 그 카테고리가 걸린 채로 전체 보기가 열리고, 사진을 누르면 그 팝업 상세로
 * 곧장 간다. 어느 쪽도 <b>SEO 랜딩으로 보내지 않는다</b> — 이미 있는 페이지로 넘기는 것은
 * 새 화면을 만든 것이 아니라 링크를 놓은 것이다.
 *
 * <p><b>카테고리는 전부 내놓는다.</b> 예전엔 넷만 보이고 머리의 화살표 한 쌍으로 창을 밀었는데,
 * 그러면 "지금 안 보이는 카테고리가 있다" 는 사실 자체가 숨는다. 지금은 모든 줄을 내놓고
 * <b>화살표는 줄마다 하나씩</b> 둔다 — 그 줄 안에서 옆으로 넘기는 용도다.
 *
 * <p><b>제목은 글자다.</b> POP-LOOK 은 {@link SectionLogo} 로 공식 CI 워드마크를 쓰지만
 * POP-ALL 용 로고는 없다({@code BrandLogos} 는 자동 생성이고 직접 수정이 금지돼 있다). 없는
 * 로고를 흉내 내 그리는 대신, 이 사이트가 <b>같은 처지의 제목에 이미 쓰고 있는 방식</b>을 따른다
 * — POP-COURSE 와 같은 {@code font-display-en} + 라임색 하이픈이다.
 */

interface Props {
  /** 모든 카테고리 줄. 잘라서 주지 않는다 — 전부 내놓는 것이 이 자리의 일이다. */
  rows: PreviewRow[];
  /** 화면이 말하는 전체 곳 수. 버튼 문구에 그대로 쓰인다. */
  total: number;
  /** 카테고리를 주면 그 조건이 걸린 채로 전체 보기가 열린다. */
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
}

export default function PopAllPreview({ rows, total, onOpenAll, onOpenPopup }: Props) {
  const { t } = useLocale();
  const reduce = useReducedMotion();

  return (
    <div className="rounded-[2rem] border border-black/[0.06] bg-white p-5 text-ink-900 shadow-pop md:p-8 dark:border-transparent dark:bg-ink-900 dark:text-cream-200">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          {/* POP-COURSE 와 같은 처리 — 공식 워드마크가 없는 POP-* 제목에 이 사이트가 쓰는 방식이다. */}
          <h2 className="font-display-en text-2xl font-extrabold tracking-tighter text-foreground md:text-4xl lg:text-5xl">
            POP<span className="text-lime-300">-</span>ALL
          </h2>
          <p className="mt-1.5 text-xs text-ink-500 md:text-sm dark:text-cream-200/55">
            {t('popall.tagline')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenAll()}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-ink-900 transition hover:brightness-105"
        >
          {total.toLocaleString()}
          {t('popall.countSuffix')}
          <ChevronRight size={15} />
        </button>
      </header>

      <div className="space-y-5">
        {rows.length === 0
          ? // 로딩 골격 — 실제 줄과 같은 높이라 데이터가 도착해도 화면이 튀지 않는다.
            [...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="mb-2 h-3.5 w-14 rounded bg-black/10 dark:bg-white/10" />
                <div className="flex gap-3">
                  {[...Array(10)].map((_, j) => (
                    <div
                      key={j}
                      className="h-[140px] w-28 shrink-0 animate-pulse rounded-2xl bg-black/[0.07] dark:bg-white/[0.07]"
                    />
                  ))}
                </div>
              </div>
            ))
          : rows.map((row, rowIdx) => (
              <CategoryRow
                key={row.code}
                row={row}
                rowIdx={rowIdx}
                reduce={reduce ?? false}
                onOpenAll={onOpenAll}
                onOpenPopup={onOpenPopup}
              />
            ))}
      </div>
    </div>
  );
}

/**
 * 카테고리 한 줄 — 제목 · 좌우 화살표 · 가로로 미는 사진 목록.
 *
 * <p>화살표를 줄마다 따로 두므로 스크롤 상태도 줄마다 따로 가져야 한다. 그래서 별도 컴포넌트다 —
 * 부모가 줄 수만큼의 ref 를 들고 있으면 줄이 늘거나 줄 때마다 그 배열을 손으로 맞춰야 한다.
 */
function CategoryRow({
  row,
  rowIdx,
  reduce,
  onOpenAll,
  onOpenPopup,
}: {
  row: PreviewRow;
  rowIdx: number;
  reduce: boolean;
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
}) {
  const { t, locale } = useLocale();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState<{ start: boolean; end: boolean }>({ start: true, end: true });

  /**
   * 지금 양쪽 끝에 닿아 있는가. 화살표를 흐리게 할지 정한다.
   *
   * <p>{@code useEffect} 대신 <b>ref 콜백과 scroll 이벤트</b>에서 잰다. effect 로 재려면 "언제
   * 다시 재야 하는가" 를 손으로 관리해야 하는데(줄이 바뀔 때, 폭이 바뀔 때, 사진이 늦게 올 때)
   * 재야 할 순간은 결국 <b>DOM 이 붙는 순간과 스크롤이 움직이는 순간</b>이다.
   */
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const start = node.scrollLeft <= 1;
    const end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
    setEdge((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  /**
   * DOM 이 붙을 때 한 번 재고, <b>폭이 바뀔 때마다</b> 다시 잰다.
   *
   * <p>스크롤만 듣고 있으면 창을 넓혔을 때 상태가 낡는다 — 열여덟 곳이 다 들어갈 만큼 넓어져도
   * 「다음」이 살아 있고, 좁혔는데 여전히 죽어 있다. 폭 변화는 scroll 이벤트를 일으키지 않으므로
   * 스크롤 리스너로는 잡을 수 없다.
   *
   * <p>React 19 의 ref 콜백은 정리 함수를 돌려줄 수 있어 effect 없이 관찰자를 붙였다 뗄 수 있다.
   */
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      scrollerRef.current = node;
      if (!node) return;
      measure(node);
      const observer = new ResizeObserver(() => measure(node));
      observer.observe(node);
      return () => {
        observer.disconnect();
        scrollerRef.current = null;
      };
    },
    [measure],
  );

  /** 보이는 폭의 80%씩 민다 — 한 화면을 통째로 갈아치우지 않아 이어 보는 흐름이 끊기지 않는다. */
  const nudge = (dir: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: dir * node.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };

  const def = CATEGORIES.find((c) => c.code === row.code);
  // 이 줄에 연출 이미지가 한 장이라도 있으면 줄 머리에 고지를 한 번 붙인다.
  const hasStyled = row.popups.some((p) => isPexelsPhoto(p));
  const label = def ? localizedLabel(def, locale) : row.code;
  const arrowCls =
    'grid size-7 place-items-center rounded-full border border-black/[0.08] text-ink-500 transition hover:border-lime-400 hover:text-lime-600 disabled:pointer-events-none disabled:opacity-25 dark:border-white/15 dark:text-cream-200/60 dark:hover:text-lime-300';

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reduce ? 0 : rowIdx * 0.06, ease: 'easeOut' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenAll(row.code)}
          className="group/head flex items-center gap-0.5 text-sm font-bold text-ink-700 transition hover:text-lime-600 dark:text-cream-200/80 dark:hover:text-lime-300"
        >
          {label}
          <ChevronRight
            size={14}
            className="transition-transform group-hover/head:translate-x-0.5"
          />
        </button>

        <div className="flex items-center gap-2">
          {/* 연출 이미지 고지 — 칸마다 붙이면 읽을 수 없는 크기가 되고 한 화면에 수십 개가 된다.
              줄에 한 번 두면 그 줄의 사진 전부를 덮으면서 읽을 수 있다. 문구는 카드가 쓰는 것과
              <b>같은 키</b>다 — 같은 고지가 화면마다 다른 말로 나오면 고지로서 신뢰를 잃는다.
              촬영자 크레딧은 카드 목록과 마찬가지로 생략하고, 눌러서 들어간 상세 페이지가
              출처와 함께 보여준다. */}
          {hasStyled && (
            <span className="hidden text-[10px] font-medium text-ink-400 sm:inline dark:text-cream-200/35">
              {t('photo.styledTooltip')}
            </span>
          )}
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={edge.start}
            aria-label={rowArrowLabel(label, 'prev', locale)}
            className={arrowCls}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={edge.end}
            aria-label={rowArrowLabel(label, 'next', locale)}
            className={arrowCls}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div
        ref={attach}
        onScroll={(e) => measure(e.currentTarget)}
        className="flex snap-x gap-3 overflow-x-auto pb-1"
      >
        {row.popups.map((p) => {
          const name = bilingual(
            p.name,
            locale === 'en' ? p.nameEn : locale === 'ja' ? p.nameJa : null,
          );
          /*
           * 사진이 있으면 사진을, 없으면 카테고리 그라디언트를 쓴다.
           *
           * <p>연출 이미지(Pexels)도 보여준다 — 고지는 줄 머리에 한 번 붙는다. 실측상 이 사이트
           * 팝업의 67%가 연출 이미지이고 실제 현장 사진은 아직 0장이라, 연출 이미지를 빼면 이
           * 자리는 사진이 없는 자리가 된다.
           */
          const cover = popupCoverUrl(p);
          const visual = categoryVisual(p.category);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenPopup(p.id)}
              title={name.display || p.name}
              className="w-28 shrink-0 snap-start text-left transition hover:-translate-y-1"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream-300 dark:bg-ink-800">
                {cover ? (
                  // 크롤링 imageUrl 은 임의 호스트라 next/image 를 쓸 수 없다(도메인 화이트리스트
                  // 불가). PopupCard 와 같은 이유로 순수 img 를 쓴다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSized(cover)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${visual.grad}`}
                  >
                    <visual.Icon size={26} strokeWidth={1.5} className="text-white/70" />
                  </div>
                )}
              </div>
              <span className="mt-1.5 line-clamp-2 block text-[11px] font-semibold leading-tight text-ink-700 dark:text-cream-200/80">
                {name.display || p.name}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * 줄 화살표의 낭독기 이름 — <b>어느 카테고리의</b> 화살표인지까지 말한다.
 *
 * <p>줄마다 화살표가 있으므로 "이전"·"다음" 만으로는 여섯 쌍이 모두 같은 이름을 갖는다. 화면을
 * 못 보는 사람에게는 그 목록이 통째로 구분되지 않는다.
 */
function rowArrowLabel(category: string, dir: 'prev' | 'next', locale: Locale): string {
  if (locale === 'en') return `${dir === 'prev' ? 'Previous' : 'Next'} ${category} pop-ups`;
  if (locale === 'ja') return `${category} ${dir === 'prev' ? '前へ' : '次へ'}`;
  return `${category} ${dir === 'prev' ? '이전' : '다음'}`;
}

/**
 * Pexels CDN 주소를 미리보기 칸 크기로 줄인다.
 *
 * <p>원본은 {@code w=800} 인데 이 칸은 112px 이다 — 일곱 배 큰 그림을 받아 줄여 그리는 셈이고,
 * 한 화면에 수십 장이니 그 낭비가 그만큼 커진다. Pexels CDN 이 {@code w}/{@code h} 파라미터로
 * 서버에서 줄여 주므로 받는 바이트 자체를 줄인다.
 *
 * <p>w 만 바꾸고 h 를 남겨 두면 안 된다. 원본 주소에는 h=1200 이 붙어 있어서, w 만 줄이면
 * fit=crop 과 만나 실없는 비율을 요청하게 된다(실제로 그렇게 만들었다가 마흔 장이 전부 응답을
 * 못 받았다). 칸이 4:5 이므로 둘을 같이 그 비율로 맞춘다.
 *
 * <p>Pexels 가 아닌 주소는 손대지 않는다 — 다른 호스트가 이 파라미터를 어떻게 해석할지 모른다.
 */
function previewSized(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== 'images.pexels.com') return url;
    u.searchParams.set('w', '224');
    if (u.searchParams.has('h')) u.searchParams.set('h', '280');
    return u.toString();
  } catch {
    return url;
  }
}
