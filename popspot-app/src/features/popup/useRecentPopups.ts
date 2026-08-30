import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * 최근 본 팝업 — 시안 전체보기 아래의 가로 레일과 "본 곳" 흐리기가 이걸 쓴다.
 *
 * <p>웹은 {@code lib/recentVisits.ts} 에서 localStorage 로 같은 일을 한다. 앱은 저장소만 다르고
 * 규칙은 같게 둔다 — 같은 사람이 웹과 앱을 오갈 때 "본 곳" 판정이 달라지면 그게 더 이상하다.
 *
 * <p><b>서버에 보내지 않는다.</b> 무엇을 봤는지는 기기 안에만 둔다. 목록을 서버로 올리면 계정 없이
 * 쓰는 사람의 관심사를 서버가 알게 되고, 이 앱은 로그인 없이도 쓸 수 있어야 한다.
 */

const KEY = 'popspot-recent-popups';

/**
 * 몇 개까지 기억할 것인가.
 *
 * <p>20 은 화면에 보이는 수(가로 레일 3~4개)보다 넉넉하되, "본 곳" 흐리기가 <b>몇 달 전 기록까지</b>
 * 끌고 오지 않는 선이다. 오래된 것까지 흐려 놓으면 목록이 통째로 회색이 되어 신호가 사라진다.
 */
const LIMIT = 20;

export interface RecentPopups {
  /** 최근에 본 순서. 앞이 가장 최근. */
  ids: number[];
  /** 상세를 열 때 부른다. */
  push: (id: number) => void;
  has: (id: number) => boolean;
}

export function useRecentPopups(): RecentPopups {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        /* 저장된 값을 믿지 않는다 — 예전 버전이 다른 모양으로 넣어 두었을 수 있고, 그때 화면이
           죽는 것보다 기록을 잃는 편이 낫다. */
        if (Array.isArray(parsed)) setIds(parsed.filter((n) => typeof n === 'number'));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const push = useCallback((id: number) => {
    setIds((prev) => {
      const next = [id, ...prev.filter((n) => n !== id)].slice(0, LIMIT);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, push, has };
}
