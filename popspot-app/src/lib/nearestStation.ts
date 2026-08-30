import stations from '@/data/stations.json';

import { walkInfo } from './walkGroups';

/**
 * 좌표에서 가장 가까운 지하철역과 도보 분.
 *
 * <p>원안은 <b>출구 번호</b>까지 쓰자고 했지만(「성수역 3번 출구」) pmtiles 의 출구 2,140개 중
 * 번호가 붙은 것은 92개(30개 역)뿐이다. 홍대입구·명동·여의도가 빠져 있어 무작정 최근접 조인을
 * 하면 홍대 좌표에서 「신길역 3번 출구 · 도보 74분」 이 나온다. 그래서 <b>역 이름까지만</b> 한다.
 *
 * <p>{@code maxMinutes} 를 넘으면 {@code null} — 도보 30분 걸리는 역은 가는 법이 아니라 소음이다.
 */
export function nearestStation(
  lat: number,
  lng: number,
  maxMinutes = 15,
): { name: string; minutes: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: { name: string; minutes: number } | null = null;
  for (const s of stations as { name: string; lat: number; lng: number }[]) {
    const info = walkInfo(lat, lng, s.lat, s.lng);
    if (best === null || info.time < best.minutes) best = { name: s.name, minutes: info.time };
  }
  return best && best.minutes <= maxMinutes ? best : null;
}
