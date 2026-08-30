import { create } from 'zustand';

import { apiJson } from '@/lib/api';
import { devMockPopups } from '@/lib/devMockPopups';
import { fallbackCoordKeys, hasRealMapLocation } from '@/lib/fallbackCoords';
import { groupSameEvent } from '@/lib/groupSameEvent';
import { isOpenNow, kstTodayStart } from '@/lib/popupSlices';
import { isCoordOutsideSeoul } from '@/lib/seoulGuard';
import type { PopupStore as Popup } from '@/types/popup';

/**
 * 팝업 목록 <b>하나</b>를 앱 전체가 나눠 쓴다.
 *
 * <h3>왜 스토어인가 — 화면마다 1.35MB 를 다시 받고 있었다</h3>
 *
 * <p>{@code usePopups} 는 원래 평범한 훅이었다. 그래서 그것을 부르는 <b>화면 열 곳이 각자</b>
 * {@code /api/popups} 를 받았다. 응답이 <b>1,347,991바이트</b>다(실측 2026-08-30). 홈 → 상세 →
 * 전체보기 → 일정만 눌러도 5.4MB 를 이동통신망으로 내려받는 셈이고, 화면을 열 때마다 목록이
 * 비었다가 채워져 카드가 한 번 깜빡인다.
 *
 * <p>스토어로 올리면 <b>한 번만</b> 받고, 파생 계산({@code open}/{@code mappable}/{@code popAll})도
 * 목록이 바뀔 때 한 번만 돈다 — 훅에 두면 화면 열 곳이 1,455건을 각자 훑는다.
 *
 * <h3>새로 수집한 팝업은 언제 보이나</h3>
 *
 * <p>웹 관리자에서 「지금 수집하기」를 누르면 같은 DB 에 쌓이고 앱은 같은 {@code /api/popups} 를
 * 본다 — <b>따로 하는 일이 없어도 반영된다.</b> 다만 즉시는 아니다:
 *
 * <ul>
 *   <li>서버가 목록에 {@code Cache-Control: max-age=300} 을 붙인다 — 최대 5분
 *   <li>검수 대기({@code PENDING_REVIEW})는 목록에 아예 안 나온다. 승인돼야 보인다
 *   <li>그 뒤에도 앱 기준을 통과해야 한다 — {@code isOpenNow}, 좌표 있음, 서울 안
 * </ul>
 *
 * <p>그래서 이 스토어도 <b>5분 지나면 다시 받는다</b>(서버 캐시와 같은 값). 그보다 빨리 보려면
 * 홈의 「목록 새로고침」이 {@link reload} 를 부른다.
 */

/** 이 목록이 어디서 왔는가. 화면이 목업을 진짜인 척 그리지 않게 하려고 함께 돌려준다. */
export type PopupSource = 'api' | 'mock';

/** 서버 목록 캐시와 같은 값. 더 짧게 잡아도 서버가 같은 응답을 준다. */
const STALE_MS = 5 * 60 * 1000;

/** 목록 API 응답. 페이지 형태로 올 때도 있어 둘 다 받는다. */
type PopupsResponse = Popup[] | { content?: Popup[] };

function unwrap(data: PopupsResponse): Popup[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data.content) ? data.content : [];
}

export interface Derived {
  open: Popup[];
  mappable: Popup[];
  popAll: Popup[];
}

/**
 * 웹 {@code HomeClient} 가 유도하는 네 단계를 그대로 계산한다.
 *
 * <p>목록이 바뀔 때 <b>한 번만</b> 돈다 — 화면마다 계산하면 1,455건을 열 번 훑는다.
 */
export function derive(catalog: Popup[], today: Date = kstTodayStart()): Derived {
  const open = catalog.filter((p) => p && isOpenNow(p.startDate, p.endDate, today));

  /* 가짜 위치 판정은 반드시 open 전체로 센다 — 카테고리로 거른 부분 목록으로 세면 문턱(40)을
     못 넘겨서 지역 중심점이 되살아난다. */
  const fallback = fallbackCoordKeys(open);
  const mappable = open
    .filter((p) => hasRealMapLocation(p, fallback))
    /* 서울 밖 좌표를 뺀다. 우리 타일(seoul.pmtiles)이 서울 언저리만 담고 있어서, 수원·판교·
       대전 팝업의 핀은 아무것도 없는 회색 위에 찍힌다 — 지도에서 "찾을 수 있는 곳" 이 아니다.
       웹 홈은 이 필터를 안 걸지만(웹 1,036 / 앱 1,001), 웹도 같은 판정을 mappable.ts 에 만들어
       두고 랜딩 지도에는 쓴다. 자세한 이유는 README 「목록은 한 곳에서만 거른다」. */
    .filter((p) => !isCoordOutsideSeoul({ latitude: p.latitude ?? null, longitude: p.longitude ?? null }));

  /* 같은 행사가 이름만 조금씩 다른 여러 줄로 들어와 있으면 "갈 수 있는 곳" 을 여러 곳으로 세는
     셈인데, 실제로 갈 수 있는 곳은 한 곳이다. 조회수는 합산한다 — 네 줄로 쪼개졌던 행사를
     대표 한 줄의 조회수로만 평가하면 인기순에서 부당하게 밀린다. */
  const popAll = groupSameEvent(mappable).map((g) => {
    if (g.duplicates.length === 0) return g.lead;
    const merged = g.duplicates.reduce((sum, d) => sum + (d.viewCount || 0), g.lead.viewCount || 0);
    return { ...g.lead, viewCount: merged };
  });

  return { open, mappable, popAll };
}

interface PopupStoreState extends Derived {
  /** 걸러지지 않은 전체 카탈로그. 달력 전용. */
  catalog: Popup[];
  source: PopupSource;
  loading: boolean;
  error: Error | null;
  /** 마지막으로 받아온 시각. 0 이면 아직 받은 적이 없다. */
  fetchedAt: number;
  /** 화면이 마운트될 때 부른다. 신선하면 아무 일도 하지 않는다. */
  hydrate: () => void;
  /** 무조건 다시 받는다 — 「목록 새로고침」 버튼. */
  reload: () => void;
}

/** 요청이 날아가 있는 중인가. 화면 열 개가 동시에 마운트돼도 한 번만 나간다. */
let inFlight: Promise<void> | null = null;

export const usePopupStore = create<PopupStoreState>((set, get) => {
  const load = (): Promise<void> => {
    if (inFlight) return inFlight;
    set({ loading: true });

    inFlight = apiJson<PopupsResponse>('/api/popups')
      .then((data) => {
        const list = unwrap(data);
        /* 서버가 200 에 빈 배열을 주는 경우가 있다(장애 중 프록시가 껍데기만 돌려줄 때). 그걸
           그대로 그리면 "오늘 서울에 팝업이 하나도 없다" 는 거짓말이 된다. 목업으로 간다. */
        if (list.length === 0) throw new Error('popups: empty');
        set({ catalog: list, ...derive(list), source: 'api', error: null, fetchedAt: Date.now() });
      })
      .catch((cause: Error) => {
        const mock = devMockPopups();
        set({ catalog: mock, ...derive(mock), source: 'mock', error: cause, fetchedAt: Date.now() });
      })
      .finally(() => {
        set({ loading: false });
        inFlight = null;
      });

    return inFlight;
  };

  return {
    catalog: [],
    open: [],
    mappable: [],
    popAll: [],
    source: 'api',
    loading: true,
    error: null,
    fetchedAt: 0,

    hydrate: () => {
      const { fetchedAt } = get();
      if (fetchedAt !== 0 && Date.now() - fetchedAt < STALE_MS) return;
      void load();
    },

    reload: () => {
      /* 신선도를 보지 않는다 — 사용자가 누른 것은 "지금 다시" 라는 뜻이다. 방금 받았더라도
         다시 받아야 관리자가 막 수집한 팝업이 보인다. */
      void load();
    },
  };
});
