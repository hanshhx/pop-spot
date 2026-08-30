import { create } from 'zustand';

import type { PopupStore } from '@/types/popup';
import { attachPersist } from './persist';

/**
 * 코스에 담은 곳들 — 웹 {@code store/useChatStore.ts} 와 같은 자리(Zustand + 영속).
 *
 * <p>코스 탭과 플래너, 상세의 "코스 추가" 가 <b>같은 목록</b>을 봐야 한다. 화면마다 상태를 들면
 * 코스에서 짠 동선을 플래너가 모르고, 상세에서 담은 곳이 어디로도 가지 않는다.
 *
 * <p>영속시키는 이유는 앱이 자주 죽어서가 아니라 <b>길찾기 때문</b>이다. 지도를 켜 두고 걷다가
 * 앱이 뒤로 밀려 메모리에서 내려가면, 돌아왔을 때 동선이 사라져 있으면 안 된다.
 *
 * <p>담는 것은 <b>팝업 전체</b>가 아니라 필요한 칸만이다. 목록 응답이 1.3MB 라 통째로 저장하면
 * 저장소가 금방 커지고, 저장해 둔 사진 주소가 만료되면 오래된 사진이 남는다. id 와 좌표만 두고
 * 나머지는 그때그때 목록에서 다시 찾는다.
 *
 * <p>영속은 {@code zustand/middleware} 가 아니라 {@link attachPersist} 로 붙인다 — 그 미들웨어를
 * 가져오면 웹 빌드가 깨진다. 이유는 {@code store/persist.ts} 에 적어 두었다.
 */

export interface PlanStop {
  id: number;
  name: string;
  lat: number;
  lng: number;
  location: string;
}

interface PlanStore {
  stops: PlanStop[];
  /** 이미 담은 곳은 다시 담지 않는다 — 같은 곳을 두 번 도는 동선이 나온다. */
  add: (stop: PlanStop) => void;
  remove: (id: number) => void;
  /** 손으로 순서 바꾸기. 시안의 위·아래 화살표. */
  move: (index: number, direction: -1 | 1) => void;
  /** 최적화 결과로 통째로 교체. */
  replace: (stops: PlanStop[]) => void;
  clear: () => void;
}

/** 팝업 하나를 담을 수 있는 모양으로. 좌표가 없으면 담을 수 없다 — 동선을 그릴 수 없다. */
export function toPlanStop(popup: PopupStore): PlanStop | null {
  const lat = Number(String(popup.latitude ?? '').trim());
  const lng = Number(String(popup.longitude ?? '').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { id: popup.id, name: popup.name, lat, lng, location: popup.location };
}

export const usePlanStore = create<PlanStore>()((set) => ({
  stops: [],

  add: (stop) =>
    set((state) =>
      state.stops.some((s) => s.id === stop.id) ? state : { stops: [...state.stops, stop] },
    ),

  remove: (id) => set((state) => ({ stops: state.stops.filter((s) => s.id !== id) })),

  move: (index, direction) =>
    set((state) => {
      const next = [...state.stops];
      const target = index + direction;
      if (target < 0 || target >= next.length) return state;
      [next[index], next[target]] = [next[target], next[index]];
      return { stops: next };
    }),

  replace: (stops) => set({ stops }),
  clear: () => set({ stops: [] }),
}));

attachPersist(usePlanStore, { name: 'popspot-plan', pick: (s) => ({ stops: s.stops }) });
