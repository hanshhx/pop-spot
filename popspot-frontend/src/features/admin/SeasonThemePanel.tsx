'use client';

import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

import {
  SEASONS,
  SEASON_AUTO,
  SEASON_COOKIE,
  SEASON_COPY,
  SEASON_LABEL,
  type Season,
  type SeasonSetting,
  isSeasonSetting,
  seasonOfNow,
} from '@/lib/season';

/**
 * 계절 테마 선택.
 *
 * <p>자동은 월 기준이다(3~5 봄 / 6~8 여름 / 9~11 가을 / 12~2 겨울). 계절을 직접 고르면 그 값이
 * 이긴다 — 8월에 겨울 화면을 확인해야 하는 경우가 실제로 있고, 자동만 있으면 12월까지 기다려야
 * 한다.
 *
 * <p><b>지금은 이 브라우저에만 적용된다.</b> 값을 쿠키에 넣고 서버가 그 쿠키를 읽어 첫 HTML 부터
 * 계절을 실어 보내는 구조라, 다른 방문자에게는 여전히 월 자동이 걸린다. 전체 방문자에게 한 계절을
 * 고정하려면 백엔드에 전역 설정이 하나 필요하다 — 그건 따로 잡는다.
 */
/**
 * 고른 값을 쿠키에 넣고, 살아 있는 문서에도 즉시 반영한다.
 *
 * <p>쿠키만 쓰면 새로고침해야 색이 바뀌어서 네 계절을 눈으로 비교하기가 어렵다. 반대로 문서만
 * 바꾸면 다음 요청에 서버가 옛 계절을 실어 보내 되돌아간다 — 둘 다 해야 한다.
 */
function applySeasonSetting(next: SeasonSetting, autoSeason: Season) {
  document.cookie = `${SEASON_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.dataset.season = next === SEASON_AUTO ? autoSeason : next;
}

export function SeasonThemePanel() {
  const [setting, setSetting] = useState<SeasonSetting>(SEASON_AUTO);
  const [autoSeason, setAutoSeason] = useState<Season>('summer');

  useEffect(() => {
    // 월 판정은 브라우저 시각으로 한 번만. 서버와 시간대가 어긋나도 이 화면은 "지금 자동이면
    // 무엇인지" 를 안내하는 용도라 문제되지 않는다.
    setAutoSeason(seasonOfNow());

    const stored = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${SEASON_COOKIE}=`))
      ?.slice(SEASON_COOKIE.length + 1);
    if (isSeasonSetting(stored)) setSetting(stored);
  }, []);

  const applied: Season = setting === SEASON_AUTO ? autoSeason : setting;

  function choose(next: SeasonSetting) {
    setSetting(next);
    applySeasonSetting(next, autoSeason);
  }

  const options: { value: SeasonSetting; label: string; hint: string }[] = [
    { value: SEASON_AUTO, label: '자동', hint: `지금 ${SEASON_LABEL[autoSeason]}` },
    ...SEASONS.map((season) => ({
      value: season as SeasonSetting,
      label: SEASON_LABEL[season],
      hint: SEASON_COPY[season].months,
    })),
  ];

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-surface p-5">
      <h3 className="flex items-center gap-2 text-base font-bold">
        <Palette size={17} /> 계절 테마
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        고른 계절이 헤더·로고·배경과 계절 한정 신호에 바로 적용됩니다. 자동은 월 기준입니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = setting === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
              aria-pressed={active}
              className={`rounded-xl border px-4 py-2.5 text-left transition ${
                active
                  ? 'border-lime-400 bg-lime-300 text-ink-900'
                  : 'border-[var(--color-border)] hover:border-lime-300/60'
              }`}
            >
              <span className="block text-sm font-bold">{option.label}</span>
              <span
                className={`block text-xs ${active ? 'text-ink-900/70' : 'text-muted-foreground'}`}
              >
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-border)] p-4">
        <p className="text-xs font-bold text-muted-foreground">
          적용 중 — {SEASON_LABEL[applied]}
          {setting === SEASON_AUTO ? ' (자동)' : ''}
        </p>
        <p className="mt-2 text-sm font-bold">{SEASON_COPY[applied].lead}</p>
        {/* 토큰 미리보기. 배경·라임은 화면 전체를 덮는 몫이고, 강조 신호 둘은 좁은 면적에만 쓴다. */}
        <div className="mt-3 flex gap-2">
          {(
            [
              ['배경', 'var(--s-bg)'],
              ['카드 면', 'var(--s-surface)'],
              ['주 동작', 'var(--s-lime)'],
              ['기간 · 긴급', 'var(--s-accent)'],
              ['강조 신호', 'var(--s-hi)'],
              ['강조 보조', 'var(--s-hi2)'],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex-1">
              <div
                className="h-9 rounded-lg border border-[var(--color-border)]"
                style={{ background: value }}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        선택값은 이 브라우저에만 저장됩니다. 전체 방문자에게 적용하려면 백엔드 전역 설정이
        필요합니다.
      </p>
    </section>
  );
}
