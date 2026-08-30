import { useCallback, useEffect, useMemo } from 'react';

import type { RecentVisit } from '@/lib/recentVisits';
import { useRecentStore } from '@/store/useRecentStore';

/**
 * 최근 본 팝업 — 전체보기의 가로 레일, 홈의 「최근 본 팝업」, "본 곳" 흐리기, 그리고 일정 탭의
 * 「내가 본 팝업」이 함께 읽는 하나의 출처.
 *
 * <p>규칙은 전부 {@code lib/recentVisits.ts} 에 있고 웹과 같다. 목록을 들고 있는 곳은
 * {@code store/useRecentStore.ts} 이고, 이 훅은 그 둘을 화면에서 쓸 수 있게 감싸기만 한다.
 *
 * <p><b>상태를 훅 안에 두지 않는 이유</b>는 스토어 파일 주석에 있다. 요약하면, 스택 내비게이션에서
 * 홈은 상세를 열어도 살아 있어서 다시 마운트되지 않는다 — 훅마다 상태를 들면 상세에서 남긴 기록이
 * 홈에 영영 닿지 않는다.
 *
 * <p><b>예전 판본과 저장 키가 다르다.</b> 예전에는 id 배열만 20개까지 담았고
 * ({@code popspot-recent-popups}), 지금은 웹과 같은 모양({@code popspot:recent-visits})으로 이름·
 * 사진·본 시각까지 담는다. 옛 기록은 자동으로 옮기지 않는다 — 옮기려면 id 로 팝업을 되짚어 이름을
 * 채워야 하는데, 그 사이 목록에서 빠진 팝업은 이름 없는 껍데기로 남는다. 며칠분 기록이 한 번
 * 비는 대신 화면에 빈 카드가 서지 않는 쪽을 골랐다.
 */

export interface RecentPopups {
  /** 최근에 본 순서. 앞이 가장 최근. 이름·사진·본 시각까지 들어 있다. */
  visits: RecentVisit[];
  /** 같은 순서의 id 만. "본 곳" 흐리기처럼 id 만 필요한 곳에서 쓴다. */
  ids: number[];
  /** 상세를 열 때 부른다. 이름과 사진을 함께 넘겨야 목록에서 빠진 뒤에도 카드를 그릴 수 있다. */
  push: (visit: Omit<RecentVisit, 'visitedAt'>) => void;
  has: (id: number) => boolean;
  /** 하나만 지운다. 이게 없으면 하나가 거슬리는 사람이 전부를 버리게 된다. */
  remove: (id: number) => void;
  clear: () => void;
}

export function useRecentPopups(): RecentPopups {
  const visits = useRecentStore((s) => s.visits);
  const hydrate = useRecentStore((s) => s.hydrate);
  const push = useRecentStore((s) => s.push);
  const remove = useRecentStore((s) => s.remove);
  const clear = useRecentStore((s) => s.clear);

  /* 저장소 읽기는 스토어가 한 번만 한다 — 여러 화면이 동시에 불러도 안전하다. */
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ids = useMemo(() => visits.map((v) => v.popupId), [visits]);
  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { visits, ids, push, has, remove, clear };
}
