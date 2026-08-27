'use client';

import { useCallback, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import type { PreviewRow } from '@/lib/popAllPreview';
import { isPexelsPhoto, popupCoverUrl } from '@/lib/popupCover';
import { categoryLabelColor, categoryVisual } from '@/components/main/categoryVisual';
import { PopAllWordmark } from '@/components/layout/PopAllWordmark';
import { popupBadge } from '@/lib/popupBadges';
import { kstTodayStart, CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { bilingual } from '@/lib/bilingual';
import { localizedLabel, useLocale, type Locale } from '@/lib/i18n';
import type { PopupStore } from '@/types/popup';

/**
 * POP-ALL — 홈의 독립 섹션. 시안 「POP-ALL 1c 확정」을 그대로 옮긴 것이다.
 *
 * <p><b>왜 아코디언인가.</b> 일곱 줄을 한꺼번에 펼치면 한 화면에 카드가 백 장 넘게 깔린다. 많이
 * 보여주는 것과 <b>눈에 들어오는 것</b>은 다르다. 그래서 접힌 줄은 겹친 썸네일 여섯 장으로
 * "여기 이만큼 있다" 만 말하고, 실제 카드는 <b>한 줄만</b> 펼친다. 카드가 커진 것(112 → 200px)도
 * 같은 이유다 — 정보를 뺀 게 아니라 한 번에 눈에 들어오는 수를 줄였다.
 *
 * <p><b>색은 새로 만들지 않았다.</b> 분야 이름과 곳수 칩의 색은 {@link categoryLabelColor} 가
 * 대체 이미지 그라디언트에서 끌어온 값이라, 사진이 없는 카드와 저절로 맞는다. 색을 쓰는 자리는
 * 이름·칩·접기 버튼 <b>셋뿐</b>이다 — 카드 면이나 배경에 칠하면 팔레트 규칙(만채도는 화면의
 * 10% 이내)을 넘고 사진 벽과 싸운다.
 *
 * <p><b>유리판.</b> 흰 카드 대신 반투명(흰색 48% + blur 16)에 위아래만 살짝 어둡게 둔다. 뒤의
 * 계절 배경이 비쳐 이 섹션이 페이지에서 떠 있지 않게 하는 장치다.
 */

interface Props {
  /** 분야별 줄. 잘라서 주지 않는다 — 전부 내놓는 것이 이 자리의 일이다. */
  rows: PreviewRow[];
  /** 화면이 말하는 전체 곳 수. */
  total: number;
  /** 분야를 주면 그 조건이 걸린 채로 전체 보기가 열린다. */
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
  /** 이미 상세를 열어 본 팝업들. 카드에 「본 팝업」을 덮는다. */
  seenIds?: ReadonlySet<number>;
}

/** 유리판 — 라이트는 시안 값 그대로, 다크는 같은 뜻(뒤가 비치는 판)을 어두운 쪽에서 만든 값이다. */
const GLASS =
  'rounded-[24px] border border-white/60 bg-[linear-gradient(180deg,rgba(13,21,23,.10),rgba(13,21,23,0)_15%,rgba(13,21,23,0)_85%,rgba(13,21,23,.10)),rgba(255,255,255,.48)] shadow-[0_16px_40px_rgba(10,10,10,.10)] backdrop-blur-[16px] backdrop-saturate-[1.08] md:rounded-[32px] dark:border-white/12 dark:bg-[linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0)_15%,rgba(255,255,255,0)_85%,rgba(255,255,255,.06)),rgba(13,21,23,.46)]';

export default function PopAllPreview({ rows, total, onOpenAll, onOpenPopup, seenIds }: Props) {
  const { t } = useLocale();

  /*
   * 펼친 줄. 열린 줄을 다시 누르면 <b>전부 접힌다</b>(-1).
   *
   * <p>첫 줄을 열어 둔 채 시작하는 이유는, 전부 접힌 첫 화면이 "카드가 하나도 없는 섹션" 으로
   * 보이기 때문이다. 겹친 썸네일만으로는 이 자리가 무엇을 하는 곳인지 설명되지 않는다.
   */
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section aria-label={t('popall.title')} className="mb-10">
      <header className="mb-4 flex flex-col gap-4 px-1.5 md:mb-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <PopAllWordmark className="h-[35px] text-foreground md:h-16" />

        <div className="flex flex-col items-start gap-3 md:items-end">
          <p className="text-xs leading-relaxed text-[#3f6f86] md:text-right md:text-[15px] dark:text-cream-200/60">
            {t('popall.tagline')}
            <span className="hidden md:inline">
              <br />
              {t('popall.taglineSub')}
            </span>
          </p>
          {/*
           * 「전체 보기」 — 시안의 데스크톱에만 있던 것을 <b>모바일에도 같은 모양으로</b> 둔다.
           * 없으면 폭이 좁은 화면에서 전체 목록으로 들어갈 길이 아예 사라진다(줄 제목을 눌러
           * 분야별로 들어가는 길만 남는다).
           *
           * 라임이 아니라 흰 알약인 것은 시안의 판단이다 — 계절에 따라 청록으로 치환되는 라임
           * 알약이 계절을 타지 않는 워드마크의 라임과 부딪힌다.
           */}
          <button
            type="button"
            onClick={() => onOpenAll()}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-[13px] font-extrabold text-[#0d1517] shadow-[0_2px_10px_rgba(10,10,10,.08)] backdrop-blur-[8px] transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(.25,1,.5,1)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(10,10,10,.14)] dark:border-white/15 dark:bg-white/10 dark:text-cream-100"
          >
            <span className="popall-dot size-[7px] shrink-0 rounded-full bg-[#b4d45f] [animation:popall-dot_1.9s_ease-in-out_infinite_alternate]" />
            {total.toLocaleString()}
            {t('popall.countSuffix')}
            <ChevronRight size={14} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <div className={`${GLASS} px-3.5 pb-3 pt-0.5 md:px-6 md:pb-4 md:pt-1.5`}>
        {rows.length === 0
          ? [...Array(5)].map((_, i) => (
              <div key={i} className="border-t border-[#0d1517]/10 py-4 dark:border-white/10">
                <div className="h-6 w-24 animate-pulse rounded bg-black/10 dark:bg-white/10" />
              </div>
            ))
          : rows.map((row, idx) => (
              <AccordionRow
                key={row.code}
                row={row}
                idx={idx}
                open={openIdx === idx}
                seenIds={seenIds}
                onToggle={() => setOpenIdx((cur) => (cur === idx ? -1 : idx))}
                onOpenAll={onOpenAll}
                onOpenPopup={onOpenPopup}
              />
            ))}
      </div>
    </section>
  );
}

/** 접힌 줄이 보여주는 겹친 썸네일 — "여기 이만큼 있다" 를 카드 없이 말한다. */
function Deck({ popups }: { popups: PopupStore[] }) {
  return (
    <span className="hidden items-center sm:flex" aria-hidden>
      {popups.map((p, i) => (
        <span
          key={p.id}
          // 크기를 인라인 style 로 주면 안 된다 — 반응형 클래스를 덮어 데스크톱에서도 모바일
          // 치수가 그대로 남는다(실제로 그렇게 만들었다가 46x58 이 30x38 로 나왔다).
          className={`-ml-2 block h-[38px] w-[30px] overflow-hidden rounded-[7px] border-[1.5px] border-white/85 md:-ml-2.5 md:h-[58px] md:w-[46px] md:rounded-[10px] md:border-2 md:shadow-[0_3px_9px_rgba(10,10,10,.14)] ${
            i >= 4 ? 'hidden md:block' : ''
          }`}
        >
          <DeckImage popup={p} />
        </span>
      ))}
    </span>
  );
}

/** 덱 한 장. 크기는 CSS 가 정하고(모바일 30x38 / 데스크톱 46x58) 여기서는 그림만 고른다. */
function DeckImage({ popup }: { popup: PopupStore }) {
  const cover = popupCoverUrl(popup);
  const visual = categoryVisual(popup.category);
  if (!cover) {
    return <span className={`block h-full w-full bg-gradient-to-br ${visual.grad}`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={previewSized(cover, 92, 116)}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  );
}

/** 분야 한 줄 — 접혔을 때는 제목·곳수·덱, 펼쳤을 때는 화살표와 카드 열여덟 장. */
function AccordionRow({
  row,
  idx,
  open,
  seenIds,
  onToggle,
  onOpenAll,
  onOpenPopup,
}: {
  row: PreviewRow;
  idx: number;
  open: boolean;
  seenIds?: ReadonlySet<number>;
  onToggle: () => void;
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
}) {
  const { t, locale } = useLocale();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState<{ start: boolean; end: boolean }>({ start: true, end: true });

  /**
   * 지금 양쪽 끝에 닿아 있는가. 화살표를 흐리게 할지 정한다.
   *
   * <p>{@code useEffect} 대신 <b>ref 콜백 · scroll · ResizeObserver</b> 에서 잰다. 재야 하는
   * 순간은 결국 DOM 이 붙을 때, 스크롤이 움직일 때, 폭이 바뀔 때 셋뿐이고 — 폭 변화는 scroll
   * 이벤트를 일으키지 않으므로 스크롤만 듣고 있으면 창을 넓혔을 때 상태가 낡는다.
   */
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

  /** 보이는 폭의 80%씩 민다 — 한 화면을 통째로 갈아치우지 않아 이어 보는 흐름이 끊기지 않는다. */
  const nudge = (dir: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: dir * node.clientWidth * 0.8, behavior: 'smooth' });
  };

  const def = CATEGORIES.find((c) => c.code === row.code);
  const label = def ? localizedLabel(def, locale) : row.code;
  const { color, tint } = categoryLabelColor(row.code);
  const hasStyled = row.popups.some((p) => isPexelsPhoto(p));
  const today = kstTodayStart();
  const arrowCls =
    'grid size-9 place-items-center rounded-full border border-[#0d1517]/12 bg-white/70 text-[#3f6f86] transition-colors hover:bg-white hover:text-[#0d1517] disabled:pointer-events-none disabled:opacity-30 md:size-[34px] dark:border-white/15 dark:bg-white/10 dark:text-cream-200/70 dark:hover:bg-white/20 dark:hover:text-cream-100';

  return (
    <div
      className="border-t border-[#0d1517]/11 [animation:popall-reveal_.5s_cubic-bezier(.25,1,.5,1)_both] dark:border-white/10"
      style={{ animationDelay: `${idx * 70}ms` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-0 py-3.5 text-left md:gap-3 md:px-0.5 md:py-[17px]"
      >
        <span
          className="text-[20px] font-extrabold leading-[1.05] tracking-[-.03em] md:text-[26px]"
          style={{ color }}
        >
          {label}
        </span>
        <span
          className="rounded-full px-2.5 py-1 font-mono text-[11.5px] font-bold md:px-[11px] md:py-[5px] md:text-[13px]"
          style={{ color, background: tint }}
        >
          {row.total.toLocaleString()}
          <span className="hidden md:inline">{t('slice.countUnit')}</span>
        </span>

        <span className="ml-auto flex items-center gap-2 md:gap-3">
          {/*
           * 연출 이미지 고지는 <b>펼쳤든 접혔든</b> 그 줄에 붙어 있다.
           *
           * <p>시안은 펼친 줄에만 뒀지만 시안의 목업은 가짜 타일 그림이라 이 제약이 없었다.
           * 실제로는 <b>접힌 줄의 겹친 썸네일도 Pexels 연출 이미지</b>이고, 이 사이트는 그 사진에
           * 반드시 고지를 붙이기로 되어 있다. 고지 없는 스톡 사진이 화면에 남는 쪽이 시안과 한 줄
           * 어긋나는 것보다 무겁다.
           */}
          {hasStyled && (
            <span className="hidden text-[11px] font-medium text-[#6d8790] lg:inline dark:text-cream-200/45">
              {t('photo.styledTooltip')}
            </span>
          )}

          {open ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold leading-none text-white md:px-3.5 md:py-2 md:text-[12.5px]"
              style={{ background: color }}
            >
              {t('popall.collapseRow')}
              <ChevronUp size={12} strokeWidth={2.2} />
            </span>
          ) : (
            <>
              <Deck popups={row.popups.slice(0, 6)} />
              <span className="hidden items-center gap-1.5 rounded-full border border-[#0d1517]/12 bg-white/66 px-3.5 py-2 text-[12.5px] font-bold leading-none text-[#0d1517] md:inline-flex dark:border-white/15 dark:bg-white/10 dark:text-cream-100">
                {t('popall.expandRow')}
                <ChevronDown size={13} strokeWidth={2.2} />
              </span>
              <ChevronDown size={16} strokeWidth={2.2} className="text-[#3f6f86] md:hidden" />
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="[animation:popall-open_.42s_cubic-bezier(.25,1,.5,1)_both] pb-3 md:pb-5">
          <div className="mb-2.5 -mt-1 flex justify-end gap-2 md:mb-3 md:mt-0 md:gap-2.5">
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={edge.start}
              aria-label={rowArrowLabel(label, 'prev', locale)}
              className={arrowCls}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={edge.end}
              aria-label={rowArrowLabel(label, 'next', locale)}
              className={arrowCls}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div
            ref={attach}
            onScroll={(e) => measure(e.currentTarget)}
            className="flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-hidden pb-3.5 md:gap-4 md:pb-1.5"
          >
            {row.popups.map((p) => (
              <PreviewCard
                key={p.id}
                popup={p}
                seen={seenIds?.has(p.id) ?? false}
                today={today}
                locale={locale}
                onClick={() => onOpenPopup(p.id)}
              />
            ))}
            {/* 열여덟 장 끝에서 그 분야 전체로 이어 준다 — 스크롤이 끝났는데 더 볼 길이 없으면
                거기서 흐름이 끊긴다. */}
            <button
              type="button"
              onClick={() => onOpenAll(row.code)}
              className="flex w-[168px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#0d1517]/15 text-[13px] font-bold text-[#3f6f86] transition hover:border-solid hover:bg-white/50 md:w-[200px] md:rounded-[22px] dark:border-white/15 dark:text-cream-200/60 dark:hover:bg-white/5"
              style={{ aspectRatio: '4 / 5' }}
            >
              <ChevronRight size={20} />
              {label} {row.total.toLocaleString()}
              {t('slice.countUnit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 펼친 줄의 카드 한 장 — 사진 · 배지 · 이름 · 장소. */
function PreviewCard({
  popup,
  seen,
  today,
  locale,
  onClick,
}: {
  popup: PopupStore;
  seen: boolean;
  today: Date;
  locale: Locale;
  onClick: () => void;
}) {
  const { t } = useLocale();
  const name = bilingual(
    popup.name,
    locale === 'en' ? popup.nameEn : locale === 'ja' ? popup.nameJa : null,
  );
  const place = bilingual(
    popup.location,
    locale === 'en' ? popup.locationEn : locale === 'ja' ? popup.locationJa : null,
  );
  const cover = popupCoverUrl(popup);
  const visual = categoryVisual(popup.category);
  const badge = popupBadge(popup.startDate, popup.endDate, today);

  return (
    <button
      type="button"
      onClick={onClick}
      title={name.display || popup.name}
      className="group/card w-[168px] shrink-0 snap-start border-0 bg-transparent p-0 text-left transition-transform duration-300 ease-[cubic-bezier(.25,1,.5,1)] hover:-translate-y-2 md:w-[200px]"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[#ece9e0] shadow-[0_5px_14px_rgba(10,10,10,.12)] md:rounded-[22px] md:shadow-[0_8px_22px_rgba(10,10,10,.14)] dark:bg-ink-800">
        {cover ? (
          // 크롤링 imageUrl 은 임의 호스트라 next/image 를 쓸 수 없다(도메인 화이트리스트 불가).
          // PopupCard 와 같은 이유로 순수 img 를 쓴다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSized(cover, 400, 500)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-[550ms] ease-[cubic-bezier(.25,1,.5,1)] group-hover/card:scale-[1.07]"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${visual.grad}`}
          >
            <visual.Icon size={34} strokeWidth={1.5} className="text-white/70" />
          </div>
        )}

        {badge?.kind === 'closingSoon' && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#ef4444] px-2.5 py-[3px] text-[11px] font-bold leading-none text-white md:left-3 md:top-3 md:px-[11px] md:py-[5px] md:text-[12px]">
            {t('popall.badgeDday')}
            {badge.dday}
          </span>
        )}
        {badge?.kind === 'openingToday' && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#7fe0f0] px-2.5 py-[3px] text-[11px] font-bold leading-none text-[#0a0a0a] md:left-3 md:top-3 md:px-[11px] md:py-[5px] md:text-[12px]">
            {t('popall.badgeToday')}
          </span>
        )}

        {/* 「본 팝업」은 카드를 흐리게 하는 대신 <b>덮는다</b> — 사진 벽에서는 채도를 낮추는 것보다
            면을 덮는 쪽이 훨씬 잘 읽힌다. */}
        {seen && (
          <span className="absolute inset-0 flex items-end justify-end bg-[rgba(245,243,238,.5)] p-2.5 md:p-[11px] dark:bg-[rgba(13,21,23,.55)]">
            <span className="rounded-full bg-[rgba(13,21,23,.62)] px-2.5 py-1 text-[11px] font-bold leading-[1.3] text-white">
              {t('popall.seenPill')}
            </span>
          </span>
        )}
      </div>

      <span className="mt-2 line-clamp-2 block text-[13.5px] font-semibold leading-[1.35] text-[#0d1517] md:mt-[11px] md:text-[14.5px] dark:text-cream-100">
        {name.display || popup.name}
      </span>
      <span className="mt-0.5 block truncate text-[11.5px] text-[#4a6e78] md:mt-1 md:text-[12px] dark:text-cream-200/50">
        {place.display || popup.location}
      </span>
    </button>
  );
}

/**
 * 줄 화살표의 낭독기 이름 — <b>어느 분야의</b> 화살표인지까지 말한다.
 *
 * <p>펼친 줄이 하나뿐이라 지금은 한 쌍이지만, 이름을 넣어 두면 화면을 못 보는 사람이 포커스만으로
 * 어느 목록을 움직이는지 안다.
 */
function rowArrowLabel(category: string, dir: 'prev' | 'next', locale: Locale): string {
  if (locale === 'en') return `${dir === 'prev' ? 'Previous' : 'Next'} ${category} pop-ups`;
  if (locale === 'ja') return `${category} ${dir === 'prev' ? '前へ' : '次へ'}`;
  return `${category} ${dir === 'prev' ? '이전' : '다음'}`;
}

/**
 * Pexels CDN 주소를 쓰는 칸 크기로 줄인다.
 *
 * <p>원본은 {@code w=800} 인데 카드는 200px, 덱은 46px 이다 — 그대로 받으면 큰 그림을 받아 줄여
 * 그리는 셈이고, 한 화면에 수십 장이니 그 낭비가 그만큼 커진다.
 *
 * <p>w 만 바꾸고 h 를 남겨 두면 안 된다. 원본 주소에는 h=1200 이 붙어 있어서, w 만 줄이면
 * fit=crop 과 만나 실없는 비율을 요청하게 된다(실제로 그렇게 만들었다가 마흔 장이 전부 응답을
 * 못 받았다). 칸이 4:5 이므로 둘을 같이 그 비율로 맞춘다.
 *
 * <p>Pexels 가 아닌 주소는 손대지 않는다 — 다른 호스트가 이 파라미터를 어떻게 해석할지 모른다.
 */
function previewSized(url: string, w: number, h: number): string {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== 'images.pexels.com') return url;
    u.searchParams.set('w', String(w));
    if (u.searchParams.has('h')) u.searchParams.set('h', String(h));
    return u.toString();
  } catch {
    return url;
  }
}
