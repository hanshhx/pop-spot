import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiJson } from '@/lib/api';
import { devMockPopups } from '@/lib/devMockPopups';
import { fallbackCoordKeys, hasRealMapLocation } from '@/lib/fallbackCoords';
import { groupSameEvent } from '@/lib/groupSameEvent';
import { isOpenNow, kstTodayStart } from '@/lib/popupSlices';
import { isCoordOutsideSeoul } from '@/lib/seoulGuard';
import type { PopupStore } from '@/types/popup';

/**
 * 팝업 목록 하나를 앱 전체가 나눠 쓴다 — 웹 {@code HomeClient} 가 {@code /api/popups} 를 한 번 받아
 * 홈·전체보기·검색·지도에 함께 쓰는 것과 같은 구조.
 *
 * <p>화면마다 따로 부르지 않는 이유는 웹 {@code popAllQuery.ts} 주석에 있다 — 목록이 통째로
 * 메모리에 있어야 타이핑마다 즉시 결과가 나오고, 디바운스도 로딩 상태도 필요 없어진다. 전체보기의
 * "조건 하나만 풀면 N곳" 도 <b>실제로 세어서</b> 말할 수 있다.
 *
 * <h3>거르기는 여기서 <b>한 번만</b> 한다</h3>
 *
 * <p>예전에는 {@code openPopups()} 라는 함수를 내주고 화면마다 부르게 했다. 홈은 불렀고 전체보기·
 * 검색·상세·여권·마이는 <b>안 불렀다.</b> 그래서 홈은 1,268곳인데 전체보기에는 2023년 팝업까지
 * 1,455곳이 들어 있었다. 웹이 {@code isOpenNow} 문서에 적어 둔 "홈 659곳 / 지도 623곳" 과 똑같은
 * 병이고, 원인도 같다 — <b>거르는 책임을 소비자에게 나눠 주면 언젠가 한 곳이 빠진다.</b>
 *
 * <p>그래서 이 훅은 이제 원본을 그냥 돌려주지 않는다. 웹 {@code HomeClient} 가 유도하는 네 단계를
 * 그대로 계산해서 <b>이름 붙은 결과</b>로 준다. 화면은 자기에게 맞는 것을 고르기만 한다.
 *
 * <pre>
 *   catalog   원본 그대로            달력 전용 (아직 시작 안 한 것·끝난 것이 있어야 격자가 안 빈다)
 *     └ open      isOpenNow          홈 목록·랭킹·검색·전체보기 — 웹 allPopups
 *         └ mappable  좌표 있음      지도에 실제로 찍히는 것 — 웹 mappablePopups
 *             └ popAll  같은 행사 합침  화면이 말하는 개수의 근거 — 웹 popAllPopups
 * </pre>
 */

/** 이 목록이 어디서 왔는가. 화면이 목업을 진짜인 척 그리지 않게 하려고 함께 돌려준다. */
export type PopupSource = 'api' | 'mock';

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

/**
 * 지금 문이 열려 있는 것만.
 *
 * <p>거르는 기준은 웹과 같은 {@link isOpenNow} 다. 그 함수가 빼는 것은 넷이다 — 이미 종료,
 * 아직 시작 전, 날짜가 아예 없음, 그리고 종료일 없이 시작일만 90일 넘게 지난 것
 * ({@code isStale}). 사용자가 "기간이 끝났거나 기간이 표기되지 않은 팝업" 이라고 부른 것이
 * 정확히 이 넷이다.
 *
 * <p>실측(2026-08-30 라이브 1,455건): 통과 1,268 / 아직 시작 전 98 / 90일 지남 89.
 */
export function openPopups(popups: PopupStore[], today: Date = kstTodayStart()): PopupStore[] {
  return popups.filter((p) => p && isOpenNow(p.startDate, p.endDate, today));
}

export function usePopups(): PopupsState {
  const [catalog, setCatalog] = useState<PopupStore[]>([]);
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
        setCatalog(list);
        setSource('api');
        setError(null);
      })
      .catch((cause: Error) => {
        if (!alive) return;
        setCatalog(devMockPopups());
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

  /* 자정을 넘겨도 목록이 다시 오기 전까지는 어제 기준으로 그린다. 목록이 바뀔 때 함께 다시
     세므로 새로고침 한 번이면 맞고, 매 렌더마다 시계를 읽으면 memo 가 통째로 무의미해진다. */
  const derived = useMemo(() => {
    const today = kstTodayStart();
    const open = openPopups(catalog, today);

    /* 가짜 위치 판정은 반드시 open 전체로 센다 — 카테고리로 거른 부분 목록으로 세면 문턱(40)을
       못 넘겨서 지역 중심점이 되살아난다. */
    const fallback = fallbackCoordKeys(open);
    const mappable = open
      .filter((p) => hasRealMapLocation(p, fallback))
      /* 서울 밖 좌표를 뺀다. 우리 타일(seoul.pmtiles)이 서울 언저리만 담고 있어서, 수원·판교·
         대전 팝업의 핀은 <b>아무것도 없는 회색 위에</b> 찍힌다 — 줌아웃해도 지도가 안 나온다.
         실측 40곳(2026-08-30). 좌표만 보는 절반(isCoordOutsideSeoul)을 쓴다: 표기가 "서울 판교"
         라도 좌표가 서울 한복판이면 우리 타일 위에 멀쩡히 찍히므로 뺄 이유가 없다.

         <b>웹 홈은 이 필터를 안 건다</b>(웹 개수 1,036 / 여기 1,001). 웹도 같은 판정을
         mappable.ts 에 만들어 두고 랜딩 지도에는 쓰는데 홈에만 안 걸려 있다 — 홈이 더 오래된
         코드다. 앱이 웹 홈을 그대로 베끼지 않은 유일한 자리이고, 이유는 이 화면이 말하는 숫자의
         뜻이 "셀 수 있는 것" 이 아니라 <b>"갈 수 있는 것"</b> 이기 때문이다. 지도에서 찾을 수
         없는 곳을 "지도에서 찾을 수 있는 곳" 으로 세면 그 숫자가 거짓이 된다. */
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
  }, [catalog]);

  return {
    catalog,
    open: derived.open,
    mappable: derived.mappable,
    popAll: derived.popAll,
    count: derived.popAll.length,
    source,
    loading,
    error,
    reload,
  };
}
