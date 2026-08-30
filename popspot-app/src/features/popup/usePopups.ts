import { useCallback, useEffect, useState } from 'react';

import { apiJson } from '@/lib/api';
import { devMockPopups } from '@/lib/devMockPopups';
import { isOpenNow, kstTodayStart } from '@/lib/popupSlices';
import type { PopupStore } from '@/types/popup';

/**
 * 팝업 목록 하나를 앱 전체가 나눠 쓴다 — 웹 {@code HomeClient} 가 {@code /api/popups} 를 한 번 받아
 * 홈·전체보기·검색·지도에 함께 쓰는 것과 같은 구조.
 *
 * <p>화면마다 따로 부르지 않는 이유는 웹 {@code popAllQuery.ts} 주석에 있다 — 목록이 통째로
 * 메모리에 있어야 타이핑마다 즉시 결과가 나오고, 디바운스도 로딩 상태도 필요 없어진다. 전체보기의
 * "조건 하나만 풀면 N곳" 도 <b>실제로 세어서</b> 말할 수 있다.
 */

/** 이 목록이 어디서 왔는가. 화면이 목업을 진짜인 척 그리지 않게 하려고 함께 돌려준다. */
export type PopupSource = 'api' | 'mock';

export interface PopupsState {
  popups: PopupStore[];
  source: PopupSource;
  loading: boolean;
  /** 서버를 못 불렀을 때의 사유. 목업으로 그리고 있어도 비워 두지 않는다. */
  error: Error | null;
  reload: () => void;
}

/** 목록 API 응답. 페이지 형태로 올 때도 있어 둘 다 받는다. */
type PopupsResponse = PopupStore[] | { content?: PopupStore[] };

function unwrap(data: PopupsResponse): PopupStore[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data.content) ? data.content : [];
}

export function usePopups(): PopupsState {
  const [popups, setPopups] = useState<PopupStore[]>([]);
  const [source, setSource] = useState<PopupSource>('api');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    apiJson<PopupsResponse>('/api/popups')
      .then((data) => {
        if (!alive) return;
        const list = unwrap(data);
        /* 서버가 200 에 빈 배열을 주는 경우가 있다(장애 중 프록시가 껍데기만 돌려줄 때). 그걸
           그대로 그리면 "오늘 서울에 팝업이 하나도 없다" 는 거짓말이 된다. 목업으로 간다. */
        if (list.length === 0) throw new Error('popups: empty');
        setPopups(list);
        setSource('api');
        setError(null);
      })
      .catch((cause: Error) => {
        if (!alive) return;
        setPopups(devMockPopups());
        setSource('mock');
        setError(cause);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [nonce]);

  return { popups, source, loading, error, reload };
}

/**
 * 지금 문이 열려 있는 것만.
 *
 * <p>거르는 기준은 웹과 같은 {@link isOpenNow} 다 — 화면마다 날짜 해석이 다르면 "홈엔 있는데
 * 지도엔 없는" 불일치가 생긴다. 웹에서 실제로 홈 659곳 / 지도 623곳으로 갈렸던 적이 있다.
 */
export function openPopups(popups: PopupStore[], today: Date = kstTodayStart()): PopupStore[] {
  return popups.filter((p) => isOpenNow(p.startDate, p.endDate, today));
}
