'use client';

import { useEffect, useState, useTransition } from 'react';

import { setSeasonOverride } from '@/app/admin/season/actions';
import { SeasonMark } from '@/components/layout/SeasonMark';
import { SEASONS, SEASON_LABEL, SEASON_MONTHS, seasonOf, solarTermOf } from '@/lib/season';
import {
  SEASON_AUTO,
  SEASON_COOKIE,
  parseSeasonSetting,
  type SeasonSetting,
} from '@/lib/seasonOverride';
import { hasSeasonVideo, seasonVideoPath } from '@/lib/seasonVideo';

/**
 * 계절 테마를 손으로 바꾸는 화면.
 *
 * <h3>이 전환은 <b>이 브라우저에만</b> 걸린다</h3>
 *
 * <p>설정을 쿠키에 담기 때문이다. 쿠키는 그것을 받은 브라우저만 들고 다니므로, 여기서 겨울로
 * 바꿔도 <b>방문자 화면은 그대로 날짜를 따른다.</b> 계절을 미리 보고 확인하는 용도다.
 *
 * <p>모두에게 보이는 계절을 강제로 바꾸려면 서버가 그 값을 들고 있어야 한다(설정 테이블이나
 * 환경변수). 백엔드 작업이라 여기서는 하지 않았다 — 대신 지금 무엇이 걸려 있는지 화면에
 * 분명히 적어 두어, 미리보기를 전체 설정으로 착각하지 않게 한다.
 *
 * <p>클라이언트 컴포넌트인 이유는 관리자 페이지 전체가 그렇기 때문이다. 서버 액션은 클라이언트
 * 에서도 부를 수 있어, 기존 권한 게이트 안에 그대로 들어간다.
 */
export function SeasonTab() {
  const [setting, setSetting] = useState<SeasonSetting>(SEASON_AUTO);
  const [pending, startTransition] = useTransition();

  /*
   * 고정 여부는 <b>쿠키</b>로만 알 수 있다.
   *
   * <p>{@code <html data-season>} 에는 최종 결과만 적혀 있어서, 거기 'summer' 가 있어도 그것이
   * 8월이라 그런 것인지 관리자가 여름으로 고정해 둔 것인지 구분되지 않는다.
   */
  useEffect(() => {
    const fromCookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${SEASON_COOKIE}=`))
      ?.split('=')[1];
    setSetting(parseSeasonSetting(fromCookie ?? null));
  }, []);

  const byDate = seasonOf();
  const pinned = setting !== SEASON_AUTO;
  const active = pinned ? setting : byDate;

  const choose = (next: SeasonSetting) => {
    const form = new FormData();
    form.set('season', next);
    startTransition(async () => {
      await setSeasonOverride(form);
      setSetting(next);
      // 배경·로고는 서버가 그린 값을 따르므로 새로 받아야 바뀐 계절이 보인다.
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--color-border)] bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-black">계절 테마</h2>
          <p className="text-xs text-muted-foreground">
            날짜 기준 <strong className="text-foreground">{SEASON_LABEL[byDate].ko}</strong> ·{' '}
            {solarTermOf()} 무렵
          </p>
        </div>

        <p className="mt-2 rounded-xl bg-black/[0.04] px-3 py-2 text-xs leading-relaxed dark:bg-white/10">
          여기서 바꾼 계절은 <strong>이 브라우저에서만</strong> 보입니다. 방문자 화면은 그대로
          날짜를 따릅니다 — 배포 전에 계절을 미리 확인하는 용도입니다.
        </p>

        {pinned ? (
          <p className="mt-2 text-xs font-bold text-hot-600 dark:text-hot-300">
            지금 {SEASON_LABEL[setting].ko}로 고정돼 있습니다.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            날짜를 따르고 있습니다. 매달 1일 00시(KST)에 바뀝니다.
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SEASONS.map((season) => (
            <button
              key={season}
              type="button"
              disabled={pending}
              onClick={() => choose(season)}
              aria-current={active === season ? 'true' : undefined}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold transition disabled:opacity-50 ${
                active === season
                  ? 'border-lime-400 bg-lime-300 text-ink-900'
                  : 'border-[var(--color-border)] text-foreground hover:bg-foreground/[0.06]'
              }`}
            >
              <SeasonMark season={season} className="size-4" />
              {SEASON_LABEL[season].ko}
              <span className="text-[10px] font-normal opacity-70">
                {SEASON_MONTHS[season].join('·')}월
              </span>
            </button>
          ))}

          <button
            type="button"
            disabled={pending || !pinned}
            onClick={() => choose(SEASON_AUTO)}
            className="min-h-11 rounded-xl border border-[var(--color-border)] px-2 py-2 text-xs font-bold text-foreground transition hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
          >
            자동으로
            <span className="mt-0.5 block text-[10px] font-normal opacity-70">날짜 따르기</span>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-surface p-4 md:p-5">
        <h2 className="text-base font-black">계절 배경 영상</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          넓은 화면(1024px 이상)에서만 재생됩니다. 좁은 화면은 영상을 <strong>내려받지 않고</strong>{' '}
          계절색 배경만 씁니다.
        </p>

        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="py-1.5">계절</th>
              <th className="py-1.5">라이트</th>
              <th className="py-1.5">다크</th>
            </tr>
          </thead>
          <tbody>
            {SEASONS.map((season) => (
              <tr key={season} className="border-t border-[var(--color-border)]">
                <td className="py-2 font-bold">{SEASON_LABEL[season].ko}</td>
                {(['light', 'dark'] as const).map((mode) => (
                  <td key={mode} className="py-2">
                    {hasSeasonVideo(season, mode) ? (
                      <span className="font-bold text-success">있음</span>
                    ) : (
                      <span className="text-subtle-foreground">
                        없음 · <code className="text-[10px]">{seasonVideoPath(season, mode)}</code>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          파일을 <code>public/season/</code> 에 넣고 <code>src/lib/seasonVideo.ts</code> 의 목록에
          한 줄 추가하면 잡힙니다. 없는 계절은 지금 쓰던 영상으로 물러섭니다 — 경로만 적고 파일이
          없으면 배경이 검은 사각형이 되기 때문입니다.
        </p>
      </section>
    </div>
  );
}
