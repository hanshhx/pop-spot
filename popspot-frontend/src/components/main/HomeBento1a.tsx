'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  Ticket,
  CalendarDays,
  ArrowRight,
  Store,
  MapPin,
  Tag,
  CalendarRange,
  Compass,
} from 'lucide-react';
import type { CatalogDoor } from '@/lib/catalogDoors';
import { regionBySlug } from '@/lib/regions';
import { categoryBySlug, brandBySlug, periodBySlug } from '@/lib/popupSlices';
import { localizedLabel, useLocale, type Locale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

/**
 * 홈 하단 발견 존 — 1a안 (히어로 + 서브 타일).
 *
 * <p>6칸 벤토를 3칸으로: 850곳으로 들어가는 문 넷을 큰 히어로로, 나의 기록(여권)·언제 갈까(일정)를
 * 사이드 타일로. 서브 타일은 <b>유저별로 다른 값을 하드코딩하지 않고</b> 기능 설명 + 일반 일러스트만
 * 둔다(실제 카운트가 필요하면 로그인 데이터를 별도로 배선).
 *
 * <p>v2.54 — 여기 있던 실시간 랭킹(칩 4개 + 인기 상위 4)을 뺐다. POP-LOOK(1+7칸)이 이미 유일한
 * 랭킹을 맡고 있어 이 자리는 같은 여덟 곳 중 상위 4개를 다시 보여주는 두 번째 랭킹이었다 —
 * 그 칩 중 「마감임박」·「혼잡」은 눌러도 항상 0건이었다(status 가 실측상 늘 비어 있어서). 소유자가
 * 가장 중요하다고 한 것 — "몇백 건에 다양하게 들어갈 수 있어야 한다" — 을 위해 이 자리를 850곳
 * 전체로 들어가는 문 4개로 바꿨다({@link catalogDoors}). 각 문은 이미 있는 {@code /popups/[slug]}
 * SEO 랜딩으로 보낸다.
 */

/** 문의 축(key 의 "축:슬러그" 앞부분)에 따라 다른 아이콘을 쓴다 — 넷이 서로 다른 종류임을 눈으로도 보여준다. */
const AXIS_ICON: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  region: MapPin,
  category: Tag,
  period: CalendarRange,
  brand: Store,
};

/**
 * 문의 key({@code "축:슬러그"})를 화면 언어 라벨로 바꾼다.
 *
 * <p>{@link catalogDoors} 는 사전을 모른다(순수 함수라 i18n 컨텍스트가 없다) — 라벨은 부르는 쪽인
 * 여기서, 그 축의 정의(REGIONS/CATEGORIES/BRANDS/getPeriods)를 같은 슬러그로 다시 찾아 만든다.
 * 정의를 못 찾는 경우(있을 수 없지만)는 슬러그를 그대로 보여준다 — 빈 라벨보다는 낫다.
 */
function doorLabel(door: CatalogDoor, locale: Locale): string {
  const [axis, slug] = door.key.split(':');
  if (axis === 'region') {
    const def = regionBySlug(slug);
    return def ? localizedLabel(def, locale) : slug;
  }
  if (axis === 'category') {
    const def = categoryBySlug(slug);
    return def ? localizedLabel(def, locale) : slug;
  }
  if (axis === 'brand') {
    const def = brandBySlug(slug);
    return def ? localizedLabel(def, locale) : slug;
  }
  if (axis === 'period') {
    const def = periodBySlug(slug);
    return def ? localizedLabel(def, locale) : slug;
  }
  return slug;
}

interface Props {
  doors: CatalogDoor[];
  total: number;
  onNavigate: (tab: string) => void;
}

export default function HomeBento1a({ doors, total, onNavigate }: Props) {
  const { t, locale } = useLocale();

  return (
    <section
      aria-label={t('bento.aria')}
      className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2"
    >
      {/* 850곳으로 들어가는 문 4개 — 라이트=흰 카드/진한 글씨, 다크=딥카드(기존 유지) */}
      <div className="flex flex-col rounded-[2rem] border border-black/[0.06] bg-white p-5 text-ink-900 shadow-pop md:p-6 lg:col-span-2 lg:row-span-2 dark:border-transparent dark:bg-ink-900 dark:text-cream-200">
        <header className="mb-1 flex items-center gap-2">
          <Compass size={18} className="text-lime-600 dark:text-lime-300" />
          {/* 숫자는 문구 안에 박아 두지 않는다 — total(mappablePopupCount) 이 유일한 출처다.
              박아 두면 이 문구가 옆 자리의 실시간 숫자와 따로 놀게 된다(플랜을 쓸 당시엔 850이었지만
              지금은 이미 그보다 많다). */}
          <h3 className="text-lg font-black">
            {total}
            {t('bento.catalogTitleSuffix')}
          </h3>
        </header>
        <p className="mb-4 text-xs text-ink-500 dark:text-cream-200/55">{t('bento.catalogDesc')}</p>

        <div className="flex-1 space-y-2">
          {doors.length === 0
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 p-2">
                  <div className="h-10 w-10 rounded-xl bg-black/10 dark:bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-2 w-1/3 rounded bg-black/10 dark:bg-white/10" />
                  </div>
                </div>
              ))
            : doors.map((door) => {
                const axis = door.key.split(':')[0];
                const Icon = AXIS_ICON[axis] ?? Store;
                return (
                  // 랜딩 SEO 슬러그는 로케일과 무관하다(page.tsx 주석 참고) — localizedPath 가
                  // /en, /ja 접두사를 붙여준다.
                  <Link
                    key={door.key}
                    href={localizedPath(door.href, locale)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-black/[0.05] p-3 text-left transition hover:border-lime-300 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime-300/20 text-lime-700 dark:bg-lime-300/10 dark:text-lime-300">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-bold">
                        {doorLabel(door, locale)}
                      </strong>
                      <span className="block text-[11px] text-ink-500 dark:text-cream-200/45">
                        {door.count}
                        {t('slice.countUnit')}
                      </span>
                    </div>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-ink-400 dark:text-cream-200/40"
                    />
                  </Link>
                );
              })}
        </div>
      </div>

      {/* 나의 기록 (여권) — 유저별 값 없이 기능 설명만 */}
      <button
        type="button"
        onClick={() => onNavigate('PASSPORT')}
        className="group relative overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white p-5 text-left text-ink-900 shadow-pop transition hover:scale-[1.02] md:p-6 lg:col-span-1 dark:border-transparent dark:bg-ink-900 dark:text-cream-200"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/25 blur-2xl"
        />
        <Ticket
          size={120}
          className="pointer-events-none absolute -bottom-6 -right-4 rotate-[-12deg] text-amber-300/10"
          aria-hidden
        />
        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 text-ink-900">
            <Ticket size={18} />
          </span>
          <div>
            <h3 className="text-base font-black">{t('bento.recordTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-cream-200/55">
              {t('bento.recordDesc')}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-300">
              {t('bento.passportCta')}{' '}
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </button>

      {/* 언제 갈까 (일정) — 동행 타일이 있던 자리. 유저별 값 없이 기능 설명만.
          타일을 그냥 빼면 3열 격자에 구멍이 하나 남고, 무엇보다 새로 생긴 일정 탭이 홈에서
          아무 데도 안 보이게 된다. */}
      <button
        type="button"
        onClick={() => onNavigate('SCHEDULE')}
        className="group relative overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white p-5 text-left text-ink-900 shadow-pop transition hover:scale-[1.02] md:p-6 lg:col-span-1 dark:border-transparent dark:bg-ink-900 dark:text-cream-200"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-400/25 blur-2xl"
        />
        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400 text-ink-900">
            <CalendarDays size={18} />
          </span>
          <div>
            {/* 겹친 아바타 세 개가 있던 자리. 사람을 찾는 기능일 때는 맞는 그림이었지만
                달력에는 사람이 등장하지 않는다 — 뜻과 다른 장식은 빼는 편이 낫다. */}
            <h3 className="text-base font-black">{t('bento.scheduleTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-cream-200/55">
              {t('bento.scheduleDesc')}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-300">
              {t('bento.scheduleCta')}{' '}
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </button>
    </section>
  );
}
