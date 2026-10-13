'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import type { PreviewRow } from '@/lib/popAllPreview';
import { isPexelsPhoto } from '@/lib/popupCover';
import { PopAllWordmark } from '@/components/layout/PopAllWordmark';
import { CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { localizedLabel, useLocale, type Locale } from '@/lib/i18n';
import { HomeFamilyCard, HomeFamilyImage } from './HomeFamilyCard';
import style from './HomeFamily.module.css';

interface Props {
  rows: PreviewRow[];
  total: number;
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
  seenIds?: ReadonlySet<number>;
}

export default function PopAllPreview({ rows, total, onOpenAll, onOpenPopup, seenIds }: Props) {
  const { t } = useLocale();
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section id="pop-all" aria-label={t('popall.title')} className={style.panel}>
      <header className={style.head}>
        <div>
          <PopAllWordmark className={style.allLogo} />
          <p className={style.description}>{t('popall.tagline')}</p>
        </div>
        <button type="button" onClick={() => onOpenAll()} className={style.action}>
          {total.toLocaleString()}
          {t('popall.countSuffix')}
          <ArrowRight size={16} aria-hidden />
        </button>
      </header>
      {rows.length === 0
        ? [...Array(5)].map((_, i) => (
            <div key={i} className="border-t border-current/10 py-6">
              <div className="h-6 w-24 animate-pulse rounded bg-current/10" />
            </div>
          ))
        : rows.map((row, idx) => (
            <AccordionRow
              key={row.code}
              row={row}
              open={openIdx === idx}
              seenIds={seenIds}
              onToggle={() => setOpenIdx((cur) => (cur === idx ? -1 : idx))}
              onOpenAll={onOpenAll}
              onOpenPopup={onOpenPopup}
            />
          ))}
      {rows.some((row) => row.popups.some(isPexelsPhoto)) && (
        <p className="mt-2 text-right text-[10px] text-[var(--s-muted)]">
          {t('photo.styledTooltip')}
        </p>
      )}
    </section>
  );
}

function AccordionRow({
  row,
  open,
  seenIds,
  onToggle,
  onOpenAll,
  onOpenPopup,
}: {
  row: PreviewRow;
  open: boolean;
  seenIds?: ReadonlySet<number>;
  onToggle: () => void;
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
}) {
  const { t, locale } = useLocale();
  const bodyId = useId();
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const start = node.scrollLeft <= 1;
    const end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
    setEdge((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);
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
  const nudge = (dir: -1 | 1) => {
    const node = scrollerRef.current;
    node?.scrollBy({
      left: dir * node.clientWidth * 0.8,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };
  const definition = CATEGORIES.find((c) => c.code === row.code);
  const label = definition ? localizedLabel(definition, locale) : row.code;
  return (
    <div className={style.row}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={style.toggle}
      >
        <span className={style.categoryImage} aria-hidden>
          <HomeFamilyImage popup={row.popups[0]} small />
        </span>
        <span className={style.categoryName}>{label}</span>
        <span className={style.count}>
          {row.total.toLocaleString()}
          {t('slice.countUnit')}
        </span>
        <span className={style.toggleEnd}>
          {!open && (
            <span className={style.deck} aria-hidden>
              {row.popups.slice(0, 3).map((p) => (
                <span key={p.id}>
                  <HomeFamilyImage popup={p} small />
                </span>
              ))}
            </span>
          )}
          <span className={style.toggleLabel}>
            {open ? t('popall.collapseRow') : t('popall.expandRow')}
            {open ? <ChevronUp size={17} aria-hidden /> : <ChevronDown size={17} aria-hidden />}
          </span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            className={style.body}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
          >
            <div ref={attach} onScroll={(e) => measure(e.currentTarget)} className={style.rail}>
              {row.popups.map((p) => (
                <HomeFamilyCard
                  key={p.id}
                  popup={p}
                  wide
                  seen={seenIds?.has(p.id)}
                  onOpen={() => onOpenPopup(p.id)}
                />
              ))}
            </div>
            <div className={style.rowFoot}>
              <button type="button" className={style.more} onClick={() => onOpenAll(row.code)}>
                {label} {t('common.viewAll')}
                <ArrowRight size={16} aria-hidden />
              </button>
              {(!edge.start || !edge.end) && (
                <div className={style.arrows}>
                  <button
                    type="button"
                    onClick={() => nudge(-1)}
                    disabled={edge.start}
                    className={style.arrow}
                    aria-label={rowArrowLabel(label, 'prev', locale)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(1)}
                    disabled={edge.end}
                    className={style.arrow}
                    aria-label={rowArrowLabel(label, 'next', locale)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function rowArrowLabel(category: string, dir: 'prev' | 'next', locale: Locale): string {
  if (locale === 'en') return `${dir === 'prev' ? 'Previous' : 'Next'} ${category} pop-ups`;
  if (locale === 'ja') return `${category} ${dir === 'prev' ? '前へ' : '次へ'}`;
  return `${category} ${dir === 'prev' ? '이전' : '다음'}`;
}
