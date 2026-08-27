'use client';

import { Ticket, CalendarDays, ArrowRight } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

/**
 * 홈 하단 발견 존 — 나의 기록 · 언제 갈까.
 *
 * <p>두 타일 모두 <b>유저별로 다른 값을 하드코딩하지 않고</b> 기능 설명만 둔다(실제 카운트가
 * 필요하면 로그인 데이터를 별도로 배선).
 *
 * <p>v2.54 — 여기 있던 실시간 랭킹(칩 4개 + 인기 상위 4)을 뺐다. POP-LOOK 이 이미 유일한 랭킹을
 * 맡고 있어 이 자리는 같은 여덟 곳 중 상위 4개를 다시 보여주는 두 번째 랭킹이었다.
 *
 * <p>v2.55 — 그 자리를 채웠던 「N곳으로 들어가는 문」 4개도 뺐다. 문 넷은 각각 이미 있는
 * {@code /popups/[slug]} SEO 랜딩으로 보냈는데, 그건 <b>새 화면을 만든 것이 아니라 링크를 놓은
 * 것</b>이다. 소유자의 표현으로는 재탕.
 *
 * <p>v2.56 — 그 뒤를 이었던 POP-ALL 미리보기도 여기서 나갔다. 벤토 한 칸에 넣으니 카테고리 넷이
 * 좁은 폭을 나눠 써서 <b>줄마다 열 곳 중 대여섯만</b> 보였다. POP-LOOK 처럼 폭을 다 쓰는 제
 * 섹션으로 옮겨, 열 곳이 다 들어가고 좌우 화살표로 카테고리 전부를 넘겨볼 수 있게 했다.
 * 이 파일에는 이제 사이드 타일 둘만 남는다.
 */

interface Props {
  onNavigate: (tab: string) => void;
}

export default function HomeBento1a({ onNavigate }: Props) {
  const { t } = useLocale();

  return (
    <section aria-label={t('bento.aria')} className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* 나의 기록 (여권) — 유저별 값 없이 기능 설명만 */}
      <button
        type="button"
        onClick={() => onNavigate('PASSPORT')}
        className="group relative overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white p-5 text-left text-ink-900 shadow-pop transition hover:scale-[1.02] md:p-6 dark:border-transparent dark:bg-ink-900 dark:text-cream-200"
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
        className="group relative overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white p-5 text-left text-ink-900 shadow-pop transition hover:scale-[1.02] md:p-6 dark:border-transparent dark:bg-ink-900 dark:text-cream-200"
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
