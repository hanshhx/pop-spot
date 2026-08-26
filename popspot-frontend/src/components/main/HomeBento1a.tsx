'use client';

import { Ticket, CalendarDays, ArrowRight } from 'lucide-react';
import PopAllPreview from '@/components/main/PopAllPreview';
import type { PreviewRow } from '@/lib/popAllPreview';
import type { CategoryCode } from '@/lib/popupSlices';
import { useLocale } from '@/lib/i18n';

/**
 * 홈 하단 발견 존 — 히어로 + 서브 타일.
 *
 * <p>3칸 벤토: 큰 히어로 하나(POP-ALL 미리보기)와 사이드 타일 둘(나의 기록 · 언제 갈까).
 * 서브 타일은 <b>유저별로 다른 값을 하드코딩하지 않고</b> 기능 설명만 둔다.
 *
 * <p>v2.54 — 여기 있던 실시간 랭킹(칩 4개 + 인기 상위 4)을 뺐다. POP-LOOK 이 이미 유일한 랭킹을
 * 맡고 있어 이 자리는 같은 여덟 곳 중 상위 4개를 다시 보여주는 두 번째 랭킹이었다.
 *
 * <p>v2.55 — 그 자리를 채웠던 「N곳으로 들어가는 문」 4개도 뺐다. 문 넷은 각각 이미 있는
 * {@code /popups/[slug]} SEO 랜딩으로 보냈는데, 그건 <b>새 화면을 만든 것이 아니라 링크를 놓은
 * 것</b>이다. 소유자의 표현으로는 재탕. 지금은 {@link PopAllPreview} 가 카테고리마다 한 줄씩,
 * 줄마다 열 곳을 사진과 제목으로 보여주고, 어디를 누르든 이 사이트 안에서 끝난다.
 */

interface Props {
  /** 카테고리별 미리보기 줄. popAllPreviewRows 가 만든다. */
  rows: PreviewRow[];
  /** 화면이 말하는 전체 곳 수. */
  total: number;
  onOpenAll: (category?: CategoryCode) => void;
  onOpenPopup: (id: number) => void;
  onNavigate: (tab: string) => void;
}

export default function HomeBento1a({ rows, total, onOpenAll, onOpenPopup, onNavigate }: Props) {
  const { t } = useLocale();

  return (
    <section
      aria-label={t('bento.aria')}
      className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2"
    >
      <PopAllPreview rows={rows} total={total} onOpenAll={onOpenAll} onOpenPopup={onOpenPopup} />

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
