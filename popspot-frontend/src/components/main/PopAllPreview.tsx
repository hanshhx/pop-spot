'use client';

import { ChevronRight, LayoutGrid } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PreviewRow } from '@/lib/popAllPreview';
import { isPexelsPhoto, popupCoverUrl } from '@/lib/popupCover';
import { categoryVisual } from '@/components/main/categoryVisual';
import { CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { bilingual } from '@/lib/bilingual';
import { localizedLabel, useLocale } from '@/lib/i18n';

/**
 * POP-ALL 미리보기 — 벤토 히어로 자리.
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
 */

interface Props {
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

  return (
    <div className="flex flex-col rounded-[2rem] border border-black/[0.06] bg-white p-5 text-ink-900 shadow-pop md:p-6 lg:col-span-2 lg:row-span-2 dark:border-transparent dark:bg-ink-900 dark:text-cream-200">
      <header className="mb-1 flex items-center gap-2">
        <LayoutGrid size={18} className="text-lime-600 dark:text-lime-300" />
        <h3 className="text-lg font-black tracking-tight">{t('popall.title')}</h3>
      </header>
      <p className="mb-3 text-xs text-ink-500 dark:text-cream-200/55">{t('popall.tagline')}</p>

      <div className="flex-1 space-y-2.5">
        {rows.length === 0
          ? // 로딩 골격 — 실제 줄과 같은 높이라 데이터가 도착해도 화면이 튀지 않는다.
            [...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="mb-1.5 h-3 w-12 rounded bg-black/10 dark:bg-white/10" />
                <div className="flex gap-2">
                  {[...Array(8)].map((_, j) => (
                    <div
                      key={j}
                      className="h-[100px] w-20 shrink-0 animate-pulse rounded-xl bg-black/[0.07] dark:bg-white/[0.07]"
                    />
                  ))}
                </div>
              </div>
            ))
          : rows.map((row, rowIdx) => {
              const def = CATEGORIES.find((c) => c.code === row.code);
              return (
                <motion.div
                  key={row.code}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: reduce ? 0 : rowIdx * 0.06,
                    ease: 'easeOut',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenAll(row.code)}
                    className="group/head mb-1 flex items-center gap-0.5 text-[11px] font-bold text-ink-600 transition hover:text-lime-600 dark:text-cream-200/70 dark:hover:text-lime-300"
                  >
                    {def ? localizedLabel(def, locale) : row.code}
                    <ChevronRight
                      size={12}
                      className="transition-transform group-hover/head:translate-x-0.5"
                    />
                  </button>
                  {/* 가로 스크롤 — 열 곳을 다 보여주려면 접거나 넘겨야 하는데, 접으면 "더 있다"
                      는 사실이 숨고 넘기면 자리를 두 배로 먹는다. 옆으로 미는 것이 둘 다 피한다. */}
                  <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                    {row.popups.map((p) => {
                      const name = bilingual(
                        p.name,
                        locale === 'en' ? p.nameEn : locale === 'ja' ? p.nameJa : null,
                      );
                      /*
                       * 사진은 <b>그 팝업을 실제로 찍은 것</b>일 때만 쓴다.
                       *
                       * <p>Pexels 연출 이미지는 이 사이트 규칙상 「연출 이미지」 고지와 출처를
                       * 함께 보여야 하는데({@link PhotoDisclosure}), 80px 칸에는 읽을 수 있는
                       * 크기로 들어가지 않는다. 한 타일에 마흔 칸이니 고지도 마흔 개가 된다.
                       *
                       * <p>그래서 고지를 붙일 수 없는 사진은 아예 쓰지 않고, 카드가 이미 쓰는
                       * 카테고리 그라디언트로 대신한다 — 무관한 스톡 사진보다 <b>이 팝업이
                       * 무엇에 속하는지</b>를 더 정확히 말한다.
                       */
                      const cover = popupCoverUrl(p);
                      const showPhoto = cover !== null && !isPexelsPhoto(p);
                      const visual = categoryVisual(p.category);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onOpenPopup(p.id)}
                          title={name.display || p.name}
                          className="w-20 shrink-0 snap-start text-left transition hover:-translate-y-0.5"
                        >
                          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-cream-300 dark:bg-ink-800">
                            {showPhoto ? (
                              // 크롤링 imageUrl 은 임의 호스트라 next/image 를 쓸 수 없다(도메인
                              // 화이트리스트 불가). PopupCard 와 같은 이유로 순수 img 를 쓴다.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cover}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div
                                className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${visual.grad}`}
                              >
                                <visual.Icon
                                  size={20}
                                  strokeWidth={1.5}
                                  className="text-white/70"
                                />
                              </div>
                            )}
                          </div>
                          <span className="mt-1 line-clamp-2 block text-[10px] font-semibold leading-tight text-ink-700 dark:text-cream-200/80">
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

      <button
        type="button"
        onClick={() => onOpenAll()}
        className="mt-3 flex items-center justify-center gap-1 rounded-2xl bg-lime-300 py-2.5 text-sm font-black text-ink-900 transition hover:brightness-105"
      >
        {total.toLocaleString()}
        {t('popall.countSuffix')}
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
