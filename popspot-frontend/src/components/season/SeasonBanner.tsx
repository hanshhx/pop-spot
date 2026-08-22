'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { SEASON_LABEL, type Season } from '@/lib/season';
import {
  BANNER_DISMISS_KEY,
  RETURNING_KEY,
  SEASON_BANNER_COPY,
  shouldShowSeasonBanner,
} from '@/lib/seasonBanner';

/**
 * 계절이 바뀌는 <b>순간</b>에 한 번 말해 주는 배너.
 *
 * <p>시안 슬라이드 7 — "색으로 60% 전달할 것을 문장 하나가 100% 합니다." 배경 색온도를 아무리
 * 정확히 맞춰도 사람은 어제 화면을 기억하지 못한다. 말로 하는 것이 가장 싸고 가장 확실하다.
 *
 * <p>판정은 전부 {@link shouldShowSeasonBanner} 가 한다 — 2주 · 계절당 한 번 · 첫 방문자 제외.
 * 여기서는 <b>언제 그것을 묻는지</b>와 닫으면 무엇을 적어 두는지만 맡는다.
 *
 * <p>서버에서는 아무것도 그리지 않는다. 재방문 여부와 닫음 기록이 브라우저에만 있어서,
 * 서버가 지레짐작해 그리면 첫 그림과 어긋난다.
 */

interface SeasonBannerProps {
  season: Season;
  /** 이 계절 한정 목록으로 보내는 동작. 배너의 유일한 버튼이다. */
  onShowSeasonPicks?: () => void;
}

export function SeasonBanner({ season, onShowSeasonPicks }: SeasonBannerProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const returning = window.localStorage.getItem(RETURNING_KEY) === '1';
    // 이번 방문을 기록해 둔다. 다음부터 재방문자다.
    window.localStorage.setItem(RETURNING_KEY, '1');

    setShow(
      shouldShowSeasonBanner({
        season,
        now: new Date(),
        dismissedSeason: window.localStorage.getItem(BANNER_DISMISS_KEY),
        returning,
      }),
    );
  }, [season]);

  if (!show) return null;

  const copy = SEASON_BANNER_COPY[season];
  const dismiss = () => {
    window.localStorage.setItem(BANNER_DISMISS_KEY, season);
    setShow(false);
  };

  return (
    /*
     * 시안 슬라이드 6 그대로다 — 만채도 면 위에 보조신호 칩, 그리고 강조신호 버튼.
     * 신호 다섯 중 가장 센 것이고, 2주 뒤에는 스스로 사라진다.
     */
    <section
      aria-label={`${SEASON_LABEL[season].ko} 안내`}
      className="relative mb-4 overflow-hidden rounded-2xl md:mb-6"
    >
      {/* 만채도 면. 여기가 배너의 본체다. */}
      <div className="season-signal px-4 py-4 md:px-5 md:py-5">
        {/* 연도 칩 — 보조신호(노랑) 위 잉크. 시안에서 유일하게 hi2 가 쓰이는 자리다. */}
        <span className="season-signal2 inline-block rounded-pill px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
          {SEASON_LABEL[season].en} {new Date().getFullYear()}
        </span>
        <p className="mt-2 text-lg font-black md:text-xl">{copy.lead}</p>
        <p className="mt-1 max-w-[52ch] text-xs leading-relaxed opacity-90 md:text-sm">
          {copy.body}
        </p>
      </div>

      {onShowSeasonPicks && (
        // 버튼은 흰 면 위에 놓인다 — 만채도 면 위에 또 만채도를 얹으면 둘 다 죽는다.
        <div className="bg-surface px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={onShowSeasonPicks}
            className="season-signal min-h-11 w-full rounded-xl px-4 text-sm font-bold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-hi)]"
          >
            {SEASON_LABEL[season].ko} 한정 팝업 보기
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        className="season-signal absolute right-2 top-2 grid size-9 place-items-center rounded-full transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <X size={16} aria-hidden />
      </button>
    </section>
  );
}
