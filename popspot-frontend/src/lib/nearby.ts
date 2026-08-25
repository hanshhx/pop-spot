import type { PublicMapMarker } from './mapMarkers';
import { walkInfo } from './walkGroups';

/** {@link nearbyWithin} 이 돌려주는 이웃 하나. */
export interface Nearby {
  marker: PublicMapMarker;
  /** 앵커에서 이 마커까지 도보 분. */
  minutes: number;
  /** "도보 4분" 처럼 화면에 그대로 쓸 수 있는 문자열. */
  text: string;
}

function coord(marker: PublicMapMarker): { lat: number; lng: number } | null {
  const lat = Number(String(marker.latitude ?? '').trim());
  const lng = Number(String(marker.longitude ?? '').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * 앵커에서 도보 {@code maxMinutes} 안에 있는 이웃을 가까운 순으로 최대 {@code limit} 개.
 *
 * <p>상세가 <b>종점이 아니라 경유지</b>가 되게 하려고 만든다. 지금은 상세에 도착하면 다음 행동이
 * 없어서 거기서 끝난다.
 *
 * <p>{@code walkGroups} 를 쓰지 않는 이유: 그건 소비형 greedy 파티션이라 마커를 그룹에 <b>한 번씩만</b>
 * 넣고, 이웃별 시간이 아니라 그룹 최대값 하나만 준다. 여기서 필요한 건 앵커 기준 개별 거리다.
 *
 * <p>{@code selfId} 를 주면 그 마커는 뺀다 — 자기 자신이 "도보 0분" 으로 목록에 들어가면 안 된다.
 */
export function nearbyWithin(
  anchor: { lat: number; lng: number },
  markers: PublicMapMarker[],
  maxMinutes: number,
  limit: number,
  selfId?: number,
): Nearby[] {
  const out: Nearby[] = [];
  for (const marker of markers) {
    if (selfId !== undefined && marker.id === selfId) continue;
    const c = coord(marker);
    if (!c) continue;
    const info = walkInfo(anchor.lat, anchor.lng, c.lat, c.lng);
    if (info.time > maxMinutes) continue;
    out.push({ marker, minutes: info.time, text: `도보 ${info.time}분` });
  }
  return out.sort((a, b) => a.minutes - b.minutes).slice(0, limit);
}
