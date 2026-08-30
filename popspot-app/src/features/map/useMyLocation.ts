import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

/**
 * 내 위치 — 최단 동선의 출발점.
 *
 * <p>웹의 작전지도는 목록의 첫 항목을 출발점으로 삼았다. 여럿이 함께 짜는 화면이라 "누구 위치" 라는
 * 게 없었기 때문이다. 앱에는 내 위치가 있고, 그게 있어야 "가장 가까운 곳부터" 가 성립한다
 * ({@code lib/optimizeRoute.ts} 주석).
 *
 * <h3>권한을 거절하면</h3>
 *
 * <p><b>성수역으로 떨어진다.</b> 위치가 없으면 최단 동선 화면이 통째로 죽는데, 이 앱의 팝업이
 * 성수에 가장 많이 몰려 있어서 그 자리에서 시작해도 대체로 말이 된다. <b>다만 화면에 그 사실을
 * 적는다</b>({@code fallback} 이 true 다) — 내 위치인 줄 알고 따라 걸으면 엉뚱한 데서 시작한다.
 *
 * <p>정확도는 {@code Balanced} 다. 도보 동선을 짜는 데 필요한 것은 몇 미터가 아니라 <b>어느
 * 골목인지</b>이고, 최고 정확도는 배터리를 훨씬 더 쓴다.
 */

/** 성수역 3번 출구. 시안이 출발점으로 그려 둔 자리. */
export const SEONGSU_STATION = { lat: 37.5445, lng: 127.0557, label: '성수역 3번 출구' };

export interface MyLocation {
  lat: number;
  lng: number;
  label: string;
  /** 진짜 내 위치가 아니라 기본값인가. */
  fallback: boolean;
  loading: boolean;
  /** 다시 잰다 — 실내에서 첫 측위가 실패하는 일이 흔해서 손으로 누를 자리가 필요하다. */
  refresh: () => void;
}

export function useMyLocation(): MyLocation {
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const [state, setState] = useState<Omit<MyLocation, 'refresh'>>({
    ...SEONGSU_STATION,
    fallback: true,
    loading: true,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setState((s) => ({ ...s, loading: true }));
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (alive) setState((s) => ({ ...s, loading: false }));
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive) return;
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: '내 위치',
          fallback: false,
          loading: false,
        });
      } catch {
        /* 실내에서 첫 측위가 실패하는 일이 흔하다. 기본값으로 두고 화면은 계속 그린다. */
        if (alive) setState((s) => ({ ...s, loading: false }));
      }
    })();

    return () => {
      alive = false;
    };
  }, [nonce]);

  return { ...state, refresh };
}
