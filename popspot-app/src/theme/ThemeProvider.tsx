import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isSeason, resolveSeason, SEASON_STORAGE_KEY, type Season } from '@/lib/season';
import { tokensFor, type ThemeSeason, type Tokens } from './tokens';

/**
 * 지금 화면이 입고 있는 계절과 명암을 앱 전체가 하나로 공유한다 — 웹 {@code lib/seasonContext.tsx}
 * 의 앱 판.
 *
 * <p>웹이 컨텍스트를 쓰는 이유는 서버 렌더 때문이었다(각자 {@code document} 를 읽으면 첫 HTML 이
 * 어긋난다). 앱에는 서버 렌더가 없지만 <b>이유가 사라지지는 않는다</b> — 훅은 로직을 공유할 뿐
 * 상태를 공유하지 않아서, 컴포넌트마다 부르면 각자의 {@code useState} 가 생긴다. 웹에서 실제로
 * 그렇게 해 보고 한 화면에 두 언어가 섞였던 기록이 {@code i18n.tsx} 에 남아 있다.
 *
 * <p>저장은 비동기다. 그래서 첫 프레임은 <b>저장값을 모르는 상태</b>로 그려진다 — 월 기준 계절과
 * 라이트로 시작하고, 읽고 나서 다르면 바꾼다. 다르게 하려면 스플래시가 끝날 때까지 화면을 잡고
 * 있어야 하는데, 시안의 스플래시는 2.2초짜리 연출이라 그 뒤에 숨기면 로딩이 길어 보인다.
 */

interface ThemeContextValue {
  /** 지금 쓰는 색 한 벌. */
  t: Tokens;
  /** 화면이 입고 있는 계절(브랜드 포함). */
  season: ThemeSeason;
  /** 계절 자동 판정 결과 — 배지에 쓴다. {@code season} 이 'brand' 여도 이 값은 계절 하나다. */
  autoSeason: Season;
  dark: boolean;
  setSeason: (next: ThemeSeason) => void;
  setDark: (next: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 다크 설정을 담는 키. 계절과 따로 두는 이유는 웹에서도 둘이 별개의 축이기 때문이다. */
const DARK_STORAGE_KEY = 'popspot-dark';

/** 저장값이 없을 때를 뜻한다. 웹 {@code SEASON_AUTO} 와 같은 자리. */
const AUTO = 'auto';

/**
 * 아무것도 고르지 않았을 때 입는 것.
 *
 * <p><b>웹과 다른 유일한 지점이다.</b> 웹은 여기서 월 기준 계절로 떨어진다 — 사이트는 방문자가
 * 계속 오는 곳이라 계절이 바뀌는 것 자체가 신호가 된다. 앱은 <b>처음 켜는 순간</b>이 브랜드를
 * 각인시키는 유일한 기회이고, 그 화면이 8월이라는 이유로 하늘색이면 스플래시의 라임 심볼과 홈이
 * 서로 다른 앱처럼 보인다.
 *
 * <p>계절을 못 보게 막는 것이 아니다 — 마이 &gt; 테마에서 고르면 그때부터 저장값이 이긴다.
 * {@link ThemeContextValue.autoSeason} 은 계속 월을 계산하고 있으므로, 나중에 "계절 자동" 을
 * 기본으로 되돌리려면 아래 한 줄에서 이 상수를 {@code autoSeason} 으로 바꾸면 된다.
 */
const DEFAULT_SEASON: ThemeSeason = 'brand';

function isThemeSeason(value: unknown): value is ThemeSeason {
  return value === 'brand' || isSeason(value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const autoSeason = useMemo(() => resolveSeason(null, null), []);
  const [setting, setSetting] = useState<ThemeSeason | typeof AUTO>(AUTO);
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.multiGet([SEASON_STORAGE_KEY, DARK_STORAGE_KEY])
      .then((pairs) => {
        if (!alive) return;
        const saved = Object.fromEntries(pairs);
        const season = saved[SEASON_STORAGE_KEY];
        if (isThemeSeason(season)) setSetting(season);
        if (saved[DARK_STORAGE_KEY] === '1') setDarkState(true);
      })
      // 저장값을 못 읽어도 화면은 떠야 한다 — 계절은 월로도 정해진다.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setSeason = useCallback((next: ThemeSeason) => {
    setSetting(next);
    AsyncStorage.setItem(SEASON_STORAGE_KEY, next).catch(() => {});
  }, []);

  const setDark = useCallback((next: boolean) => {
    setDarkState(next);
    AsyncStorage.setItem(DARK_STORAGE_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  const season: ThemeSeason = setting === AUTO ? DEFAULT_SEASON : setting;

  const value = useMemo<ThemeContextValue>(
    () => ({ t: tokensFor(season, dark), season, autoSeason, dark, setSeason, setDark }),
    [season, autoSeason, dark, setSeason, setDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * 지금 테마. Provider 밖에서는 월 기준 계절 + 라이트로 떨어진다.
 *
 * <p>{@code null} 을 던지지 않는 이유는 스토리북·테스트에서 컴포넌트 하나만 띄울 때 매번 감싸야
 * 하는 것을 피하기 위해서다. 웹 {@code useSeason} 도 같은 이유로 월 기준으로 떨어진다.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  const autoSeason = resolveSeason(null, null);
  return {
    t: tokensFor(DEFAULT_SEASON, false),
    season: DEFAULT_SEASON,
    autoSeason,
    dark: false,
    setSeason: () => {},
    setDark: () => {},
  };
}

/** 색만 필요할 때. 화면 대부분이 이것만 쓴다. */
export function useTokens(): Tokens {
  return useTheme().t;
}
