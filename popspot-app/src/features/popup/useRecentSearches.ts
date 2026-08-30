import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * 최근 검색어 — 시안 08 검색 화면의 첫 줄.
 *
 * <p>{@code useRecentPopups} 와 형제다. 저장 규칙(앞이 최근, 중복은 앞으로 끌어올림, 상한)이
 * 같아서 하나로 합치고 싶어지는데, <b>합치지 않는다</b> — 담는 것이 숫자와 문자열로 다르고,
 * 나중에 검색어만 지우는 버튼이 생기면 팝업 기록까지 함께 지워질 위험이 생긴다. 두 저장소를
 * 한 함수로 묶어 얻는 것은 열 줄뿐이다.
 */

const KEY = 'popspot-recent-searches';

/** 칩 줄 한 줄에 들어가는 만큼. 더 두면 화면 절반이 지난 검색어가 된다. */
const LIMIT = 8;

export interface RecentSearches {
  queries: string[];
  push: (query: string) => void;
  remove: (query: string) => void;
}

export function useRecentSearches(): RecentSearches {
  const [queries, setQueries] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setQueries(parsed.filter((s) => typeof s === 'string'));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const save = (next: string[]) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  };

  const push = useCallback((query: string) => {
    const word = query.trim();
    if (!word) return;
    setQueries((prev) => save([word, ...prev.filter((q) => q !== word)].slice(0, LIMIT)));
  }, []);

  const remove = useCallback((query: string) => {
    setQueries((prev) => save(prev.filter((q) => q !== query)));
  }, []);

  return { queries, push, remove };
}
