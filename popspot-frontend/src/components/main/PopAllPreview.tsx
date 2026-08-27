'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PreviewRow } from '@/lib/popAllPreview';
import { isPexelsPhoto, popupCoverUrl } from '@/lib/popupCover';
import { categoryVisual } from '@/components/main/categoryVisual';
import { CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { bilingual } from '@/lib/bilingual';
import { localizedLabel, useLocale } from '@/lib/i18n';

/**
 * POP-ALL 미리보기 — 홈의 독립 섹션.
 *
 * <p><b>왜 이 모양인가.</b> 홈에는 팝업을 보여주는 자리가 셋이다. POP-LOOK 은 대표 하나 + 목록
 * 일곱의 <i>랭킹</i>이고, 「최근 오픈한 팝업」은 한 줄짜리 가로 <i>레일</i>이다. 셋째 자리가 또
 * 목록이면 같은 화면이 세 번 나온다. 그래서 여기는 <b>카테고리마다 한 줄, 줄마다 열 곳</b>인
 * 격자다 — 형태가 다르고, 하는 말도 다르다. 앞의 둘이 "이게 인기다 / 이게 새것이다" 라고
 * 말한다면 여기는 <b>"이만큼 다양하다"</b> 를 말한다. 주장이 아니라 눈으로.
 *
 * <p>줄 제목을 누르면 그 카테고리가 걸린 채로 전체 보기가 열리고, 사진을 누르면 그 팝업 상세로
 * 곧장 간다. 어느 쪽도 <b>SEO 랜딩으로 보내지 않는다</b> — 이미 있는 페이지로 넘기는 것은
 * 새 화면을 만든 것이 아니라 링크를 놓은 것이다.
 *
 * <p><b>제목은 글자다.</b> POP-LOOK 은 {@link SectionLogo} 로 공식 CI 워드마크를 쓰지만
 * POP-ALL 용 로고는 없다({@code BrandLogos} 는 자동 생성이고 직접 수정이 금지돼 있다). 없는
 * 로고를 흉내 내 그리는 대신 글자로 둔다 — 브랜드 자산은 지어내는 것이 아니다.
 */

/** 한 번에 보여줄 줄 수. 나머지 카테고리는 좌우 화살표로 넘긴다. */
const VISIBLE_ROWS = 4;

interface Props {
  /** <b>모든</b> 카테고리 줄. 화살표로 넘겨 보므로 잘라서 주지 않는다. */
  rows: PreviewRow[];
  /** 화면이 말하는 전체 곳 수. 버튼 문구에 그대로 쓰인다. */
  total: number;
  /** 카테고리를 주면 그 조건이 걸린 채로 전체 보기가 열린다. */
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
}

export default function PopAllPreview({ rows, total, onOpenAll, onOpenPopup }: Props) {
  const { t, locale } = useLocale();
  const reduce = useReducedMotion();

  /*
   * 몇 번째 카테고리부터 보여줄까. 한 칸씩 움직인다.
   *
   * <p>페이지 단위로 건너뛰면 마지막 페이지에서 줄 수가 줄어 섹션 높이가 튄다(카테고리가 일곱인데
   * 네 줄씩이면 마지막은 세 줄). 한 칸씩 밀면 높이가 늘 같고, 누를 때마다 <b>새 카테고리가 하나</b>
   * 들어온다 — 무엇이 새로 왔는지도 눈에 잡힌다.
   */
  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, rows.length - VISIBLE_ROWS);
  const shown = rows.slice(offset, offset + VISIBLE_ROWS);
  const canPage = rows.length > VISIBLE_ROWS;

  const arrowCls =
    'grid size-8 place-items-center rounded-full border border-black/[0.08] text-ink-500 transition hover:border-lime-400 hover:text-lime-600 disabled:pointer-events-none disabled:opacity-30 dark:border-white/15 dark:text-cream-200/60 dark:hover:text-lime-300';
  const prevLabel =
    locale === 'en' ? 'Previous categories' : locale === 'ja' ? '前のカテゴリー' : '이전 카테고리';
  const nextLabel =
    locale === 'en' ? 'Next categories' : locale === 'ja' ? '次のカテゴリー' : '다음 카테고리';

  return (
    <div className="rounded-[2rem] border border-black/[0.06] bg-white p-5 text-ink-900 shadow-pop md:p-8 dark:border-transparent dark:bg-ink-900 dark:text-cream-200">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid size={22} className="text-lime-600 dark:text-lime-300" />
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">{t('popall.title')}</h2>
          </div>
          <p className="mt-1.5 text-xs text-ink-500 md:text-sm dark:text-cream-200/55">
            {t('popall.tagline')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canPage && (
            <>
              <button
                type="button"
                onClick={() => setOffset((o) => Math.max(0, o - 1))}
                disabled={offset === 0}
                aria-label={prevLabel}
                className={arrowCls}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setOffset((o) => Math.min(maxOffset, o + 1))}
                disabled={offset >= maxOffset}
                aria-label={nextLabel}
                className={arrowCls}
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onOpenAll()}
            className="inline-flex items-center gap-1.5 rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-ink-900 transition hover:brightness-105"
          >
            {total.toLocaleString()}
            {t('popall.countSuffix')}
            <ChevronRight size={15} />
          </button>
        </div>
      </header>

      <div className="space-y-4">
        {shown.length === 0
          ? // 로딩 골격 — 실제 줄과 같은 높이라 데이터가 도착해도 화면이 튀지 않는다.
            [...Array(VISIBLE_ROWS)].map((_, i) => (
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
          : shown.map((row, rowIdx) => {
              const def = CATEGORIES.find((c) => c.code === row.code);
              // 이 줄에 연출 이미지가 한 장이라도 있으면 줄 머리에 고지를 한 번 붙인다.
              const hasStyled = row.popups.some((p) => isPexelsPhoto(p));
              return (
                <motion.div
                  // key 에 code 를 쓰면 화살표로 줄이 바뀔 때 새로 들어온 줄만 애니메이션한다.
                  key={row.code}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: reduce ? 0 : rowIdx * 0.06,
                    ease: 'easeOut',
                  }}
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAll(row.code)}
                      className="group/head flex items-center gap-0.5 text-sm font-bold text-ink-700 transition hover:text-lime-600 dark:text-cream-200/80 dark:hover:text-lime-300"
                    >
                      {def ? localizedLabel(def, locale) : row.code}
                      <ChevronRight
                        size={14}
                        className="transition-transform group-hover/head:translate-x-0.5"
                      />
                    </button>
                    {/* 연출 이미지 고지 — 칸마다 붙이면 읽을 수 없는 크기가 되고 한 화면에 마흔
                        개가 된다. 줄에 한 번 두면 그 줄의 사진 전부를 덮으면서 읽을 수 있다.
                        문구는 카드가 쓰는 것과 <b>같은 키</b>다 — 같은 고지가 화면마다 다른
                        말로 나오면 고지로서 신뢰를 잃는다. 촬영자 크레딧은 카드 목록과 마찬가지로
                        여기서 생략하고, 눌러서 들어간 상세 페이지가 출처와 함께 보여준다. */}
                    {hasStyled && (
                      <span className="shrink-0 text-[10px] font-medium text-ink-400 dark:text-cream-200/35">
                        {t('photo.styledTooltip')}
                      </span>
                    )}
                  </div>
                  {/* 넓은 화면에서는 열 곳이 다 들어가고, 좁으면 옆으로 민다. */}
                  <div className="flex snap-x gap-3 overflow-x-auto pb-1">
                    {row.popups.map((p) => {
                      const name = bilingual(
                        p.name,
                        locale === 'en' ? p.nameEn : locale === 'ja' ? p.nameJa : null,
                      );
                      /*
                       * 사진이 있으면 사진을, 없으면 카테고리 그라디언트를 쓴다.
                       *
                       * <p>연출 이미지(Pexels)도 보여준다 — 고지는 줄 머리에 한 번 붙는다.
                       * 실측상 이 사이트 팝업의 67%가 연출 이미지이고 실제 현장 사진은 아직
                       * 0장이라, 연출 이미지를 빼면 이 자리는 사진이 없는 자리가 된다.
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
                              // 크롤링 imageUrl 은 임의 호스트라 next/image 를 쓸 수 없다(도메인
                              // 화이트리스트 불가). PopupCard 와 같은 이유로 순수 img 를 쓴다.
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
                                <visual.Icon
                                  size={26}
                                  strokeWidth={1.5}
                                  className="text-white/70"
                                />
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
            })}
      </div>
    </div>
  );
}

/**
 * Pexels CDN 주소를 미리보기 칸 크기로 줄인다.
 *
 * <p>원본은 {@code w=800} 인데 이 칸은 112px 이다 — 일곱 배 큰 그림을 받아 줄여 그리는 셈이고,
 * 한 화면에 마흔 장이니 그 낭비가 마흔 배가 된다. Pexels CDN 이 {@code w}/{@code h} 파라미터로
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
