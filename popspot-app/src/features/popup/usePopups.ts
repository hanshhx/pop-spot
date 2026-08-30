import { useEffect } from 'react';

import { usePopupStore } from '@/store/usePopupStore';
import type { PopupStore } from '@/types/popup';

/**
 * 팝업 목록 하나를 앱 전체가 나눠 쓴다 — 웹 {@code HomeClient} 가 {@code /api/popups} 를 한 번 받아
 * 홈·전체보기·검색·지도에 함께 쓰는 것과 같은 구조.
 *
 * <p>목록과 파생 계산은 {@code store/usePopupStore.ts} 에 있다. 이 훅은 그것을 화면에서 쓰기 좋게
 * 감싸고, 마운트될 때 <b>필요하면</b> 받아오게 하는 것뿐이다.
 *
 * <h3>거르기는 스토어에서 <b>한 번만</b> 한다</h3>
 *
 * <p>예전에는 {@code openPopups()} 라는 함수를 내주고 화면마다 부르게 했다. 홈은 불렀고 전체보기·
 * 검색·상세·여권·마이는 <b>안 불렀다.</b> 그래서 홈은 1,268곳인데 전체보기에는 2023년 팝업까지
 * 1,455곳이 들어 있었다. 웹이 {@code isOpenNow} 문서에 적어 둔 "홈 659곳 / 지도 623곳" 과 똑같은
 * 병이고, 원인도 같다 — <b>거르는 책임을 소비자에게 나눠 주면 언젠가 한 곳이 빠진다.</b>
 *
 * <pre>
 *   catalog   원본 그대로            달력 전용 (아직 시작 안 한 것·끝난 것이 있어야 격자가 안 빈다)
 *     └ open      isOpenNow          홈 목록·랭킹·검색·전체보기 — 웹 allPopups
 *         └ mappable  좌표 있고 서울 안  지도에 실제로 찍히는 것 — 웹 mappablePopups
 *             └ popAll  같은 행사 합침  화면이 말하는 개수의 근거 — 웹 popAllPopups
 * </pre>
 */

export type { PopupSource } from '@/store/usePopupStore';

export interface PopupsState {
  /**
   * 걸러지지 않은 전체 카탈로그. <b>달력 말고는 쓰지 않는다.</b>
   *
   * <p>웹 {@code catalogPopups} 와 같은 것이다. {@code open} 은 "오늘 문이 열려 있는 것" 만
   * 남기는데 그건 달력에는 틀리다 — 다음 주에 여는 팝업이 통째로 빠지므로 <b>오늘이 아닌 날짜의
   * '오픈' 은 언제나 0</b> 이 되고, 다음 달로 넘기면 격자가 빈다.
   */
  catalog: PopupStore[];
  /** 지금 문이 열려 있는 것. 목록·검색·랭킹이 쓰는 기본값. 웹 {@code allPopups}. */
  open: PopupStore[];
  /** 그중 지도에서 실제로 찾을 수 있는 것. 웹 {@code mappablePopups}. */
  mappable: PopupStore[];
  /** 그중 같은 행사를 한 번만 센 것. 웹 {@code popAllPopups}. */
  popAll: PopupStore[];
  /**
   * <b>화면이 말하는 팝업 수는 이 하나다.</b>
   *
   * <p>세 번 걸러낸 값이다 — 오늘 열려 있고({@code open}), 지도에서 찾을 수 있고
   * ({@code mappable}), 같은 행사를 한 번만 센({@code popAll}) 것. 셀 수 있는 것이 아니라
   * <b>갈 수 있는 것을 센다</b>.
   */
  count: number;
  source: 'api' | 'mock';
  loading: boolean;
  /** 서버를 못 불렀을 때의 사유. 목업으로 그리고 있어도 비워 두지 않는다. */
  error: Error | null;
  /** 지금 다시 받는다. 관리자가 막 수집한 팝업을 바로 보려면 이것을 부른다. */
  reload: () => void;
}

export function usePopups(): PopupsState {
  const catalog = usePopupStore((s) => s.catalog);
  const open = usePopupStore((s) => s.open);
  const mappable = usePopupStore((s) => s.mappable);
  const popAll = usePopupStore((s) => s.popAll);
  const source = usePopupStore((s) => s.source);
  const loading = usePopupStore((s) => s.loading);
  const error = usePopupStore((s) => s.error);
  const hydrate = usePopupStore((s) => s.hydrate);
  const reload = usePopupStore((s) => s.reload);

  /* 신선하면 아무 일도 하지 않는다 — 화면을 옮길 때마다 1.35MB 를 다시 받지 않게. */
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return {
    catalog,
    open,
    mappable,
    popAll,
    count: popAll.length,
    source,
    loading,
    error,
    reload,
  };
}
