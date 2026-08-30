import { create } from 'zustand';

import {
  clearVisits,
  readVisits,
  recordVisit,
  removeVisit,
  type RecentVisit,
} from '@/lib/recentVisits';

/**
 * 최근 본 팝업 — <b>앱 전체가 하나의 목록을 본다.</b>
 *
 * <h3>왜 훅 안의 {@code useState} 로는 안 되는가</h3>
 *
 * <p>처음에는 화면마다 {@code useRecentPopups()} 를 부르고 그 안에서 {@code useState} 로 들었다.
 * 폰에서 확인해 보니 <b>상세를 보고 나와도 홈의 「최근 본 팝업」이 늘지 않았다.</b>
 *
 * <p>이유는 스택 내비게이션이다. 홈은 상세를 열어도 <b>스택에 그대로 살아 있다</b> — 다시 마운트
 * 되지 않으므로 저장소를 읽는 효과도 다시 돌지 않는다. 상세가 저장한 것은 상세의 상태에만 들어가고
 * 홈의 상태는 앱을 켤 때 읽은 그대로 멈춰 있다. 웹은 화면을 옮길 때마다 컴포넌트가 다시 만들어져
 * 이 문제가 드러나지 않는다 — <b>웹 코드를 그대로 옮기면 앱에서만 깨지는 자리</b>다.
 *
 * <p>{@code usePlanStore} 가 "코스 탭과 플래너와 상세가 같은 목록을 봐야 한다" 는 이유로 스토어인
 * 것과 같은 이유다. 저장소도 한 번만 읽는다.
 *
 * <p>영속은 {@code attachPersist} 를 쓰지 않는다 — 저장 규칙(중복 올리기·안전장치·튕기면 절반)이
 * {@code lib/recentVisits.ts} 에 이미 있고, 그쪽이 웹과 같은 규칙이라 두 벌로 만들면 갈린다.
 */

interface RecentStore {
  visits: RecentVisit[];
  /** 저장소를 처음 한 번 읽는다. 두 번째부터는 아무 일도 하지 않는다. */
  hydrate: () => void;
  push: (visit: Omit<RecentVisit, 'visitedAt'>) => void;
  remove: (id: number) => void;
  clear: () => void;
}

/** 읽기를 시작했는가. 화면 여럿이 동시에 마운트돼도 저장소는 한 번만 읽는다. */
let hydrated = false;

export const useRecentStore = create<RecentStore>((set) => ({
  visits: [],

  hydrate: () => {
    if (hydrated) return;
    hydrated = true;
    readVisits().then((visits) => set({ visits }));
  },

  /* 저장이 끝나기를 기다렸다가 그 결과로 화면을 맞춘다 — 화면만 먼저 고치면 저장이 실패했을 때
     다음 실행에서 조용히 되돌아가고, 사용자는 기록이 사라진 이유를 알 수 없다. */
  push: (visit) => {
    recordVisit(visit).then((visits) => set({ visits }));
  },

  remove: (id) => {
    removeVisit(id).then((visits) => set({ visits }));
  },

  clear: () => {
    clearVisits().then(() => set({ visits: [] }));
  },
}));
