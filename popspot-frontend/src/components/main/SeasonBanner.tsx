'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { SEASON_COPY } from '@/lib/season';
import { useSeason } from '@/lib/seasonContext';

/**
 * 계절 전환 배너 — 계절당 딱 한 번.
 *
 * <p>이 배너가 계절 테마에서 가장 중요한 한 조각이다. 유저는 <b>상태를 못 알아채고 순간만
 * 알아채기</b> 때문이다. 배경 색으로 60% 쯤 전달할 것을 문장 하나가 100% 한다. 이게 없으면
 * 나머지 신호는 전부 "원래 저런 색이었나 보다" 로 읽힌다.
 *
 * <p>두 가지 규칙이 붙는다.
 *
 * <ul>
 *   <li><b>첫 방문자에게는 띄우지 않는다.</b> 비교할 어제 화면이 없으니 "여름이 시작됐어요" 가
 *       뜬금없는 광고로 읽힌다. 그래서 방문 기록이 있는 사람에게만 뜬다.</li>
 *   <li><b>2주 뒤 접힌다.</b> 상주하면 3일 만에 눈에서 지워지고, 그때부터는 자리만 차지한다.
 *       접힌 뒤에도 계절 한정 필터 칩은 남으므로 진입로가 사라지지는 않는다.</li>
 * </ul>
 *
 * <p>면적 규칙: {@code --s-hi} 는 한 화면의 10% 를 넘지 않는다. 홈은 세로로 긴 화면이라 이
 * 배너 하나가 상한을 다 쓰지는 않지만, 여기에 만채도 면을 하나 더 얹으면 넘는다.
 */

/** 마지막으로 알린 계절과 그때 시각. 계절이 바뀌면 값이 갈리며 배너가 다시 뜬다. */
const SIGNAL_KEY = 'popspot-season-signal';
/** 방문 기록. 이게 없으면 첫 방문자다. */
const VISITED_KEY = 'popspot-visited';

const FOLD_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

type Signal = { season: string; firstSeenAt: number; dismissed?: boolean };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // 사파리 프라이빗 등에서 접근 자체가 던진다. 배너를 안 띄우는 쪽이 안전하다.
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장 못 해도 화면은 그대로 동작해야 한다 — 다음 방문에 한 번 더 뜰 뿐이다. */
  }
}

export default function SeasonBanner({ onExplore }: { onExplore?: () => void }) {
  const season = useSeason();
  const copy = SEASON_COPY[season];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const visited = read(VISITED_KEY);
    if (!visited) {
      // 첫 방문 — 배너는 건너뛰고 기록만 남긴다. 다음 계절 전환부터 대상이 된다.
      write(VISITED_KEY, String(Date.now()));
      return;
    }

    let signal: Signal | null = null;
    try {
      const raw = read(SIGNAL_KEY);
      signal = raw ? (JSON.parse(raw) as Signal) : null;
    } catch {
      signal = null;
    }

    if (!signal || signal.season !== season) {
      // 계절이 바뀌었다 — 알릴 순간이다.
      write(SIGNAL_KEY, JSON.stringify({ season, firstSeenAt: Date.now() } satisfies Signal));
      setVisible(true);
      return;
    }

    if (signal.dismissed) return;
    setVisible(Date.now() - signal.firstSeenAt < FOLD_AFTER_MS);
  }, [season]);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    write(
      SIGNAL_KEY,
      JSON.stringify({ season, firstSeenAt: Date.now(), dismissed: true } satisfies Signal),
    );
  }

  return (
    <section
      aria-label={copy.lead}
      /* 글자색은 --s-hi-fg 다. 흰색으로 고정하면 여덟 팔레트 중 일곱에서 AA 에 못 미친다
         (근거는 globals.css 계절 블록 주석). */
      className="relative mb-4 overflow-hidden rounded-2xl px-5 py-5 md:mb-6 md:px-7 md:py-6"
      style={{ background: 'var(--s-hi)', color: 'var(--s-hi-fg)' }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-7">
        <div className="min-w-0 flex-1">
          <span
            className="inline-flex items-center rounded-pill px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-[0.12em] text-ink-900"
            style={{ background: 'var(--s-hi2)' }}
          >
            {copy.upper} {new Date().getFullYear()}
          </span>
          <h2 className="mt-2.5 text-lg font-black tracking-tight md:text-2xl">{copy.lead}</h2>
          {/* 본문은 있을 때만 그린다 — 쓸 말이 없는 계절은 비워 둔다({@link SeasonCopy}).
              빈 문단을 남기면 제목 아래 공백만 벌어져 무언가 빠진 것처럼 보인다. */}
          {/* opacity 는 90 이 하한이다. 80 으로 흐리면 라이트 겨울(4.07:1)과 라이트 가을
              (4.27:1)이 AA 아래로 떨어진다 — 만채도 면 위에서는 약간의 흐림도 크게 먹는다. */}
          {copy.body && (
            <p className="mt-1.5 text-xs leading-relaxed opacity-90 md:text-sm">{copy.body}</p>
          )}
        </div>
        {onExplore && (
          <button
            type="button"
            onClick={onExplore}
            className="shrink-0 rounded-xl px-5 py-3 text-sm font-black transition hover:opacity-90"
            style={{ background: 'var(--s-hi-fg)', color: 'var(--s-hi)' }}
          >
            곧 마감되는 팝업 보기
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="계절 안내 닫기"
        /* 아이콘 대비 하한은 3:1. 60 이면 라이트 가을이 2.97 로 아슬하게 못 미친다. */
        className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full opacity-70 transition hover:bg-black/10 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </section>
  );
}
