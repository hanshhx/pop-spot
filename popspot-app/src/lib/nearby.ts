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
 * 위도 1e-6도(서울 위도 37° 부근에서 약 11cm) — "사실상 같은 지점" 으로 볼 오차 한도.
 *
 * <p>엄격한 {@code ===} 대신 이 오차를 두는 이유: 크롤러가 받아온 좌표 문자열은 소수 자릿수가
 * 들쭉날쭉하다("...043931" 대 "...0439310" 처럼 끝자리가 잘리거나 늘어난다). 파싱한 두 숫자가
 * 물리적으로 같은 지점을 가리켜도 부동소수점으로는 완전히 같지 않을 수 있다. 반대로 도보
 * 판단에 영향을 줄 만한 거리(수 미터 이상)는 이 오차 안에 절대 들어오지 않으므로, "정말 같은
 * 지점"만 골라내면서 표기 오차만 흡수한다.
 */
const SAME_SPOT_EPSILON_DEG = 1e-6;

function sameSpot(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  return (
    Math.abs(a.lat - b.lat) < SAME_SPOT_EPSILON_DEG &&
    Math.abs(a.lng - b.lng) < SAME_SPOT_EPSILON_DEG
  );
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
 * 하지만 실측 피드에는 <b>같은 팝업이 다른 id 로 중복된 행</b>이 많다(1,181행 중 164그룹
 * 672행, 57%가 좌표를 공유한다) — {@code selfId} 는 그 id 하나만 잡고 중복 행은 못 잡으므로,
 * 좌표가 앵커와 같은 마커는 id 와 무관하게 함께 뺀다({@link sameSpot}). "도보 0분" 이라고 뜬
 * 것이 지금 보고 있는 페이지 자신(의 중복 행)인 경우가 실제로 있었다.
 *
 * <p>좌표를 공유하는 이웃끼리도(같은 건물의 중복 행) 전부 보여주면 한 자리를 여러 번 채운다 —
 * 살아남은 후보 중에서도 좌표가 겹치면 입력에서 먼저 나온 것만 남긴다. 같은 좌표는 앵커까지의
 * 거리도 같으므로 "먼저 온 것"과 "더 가까운 것"이 항상 일치해 별도 우선순위가 필요 없다.
 */
export function nearbyWithin(
  anchor: { lat: number; lng: number },
  markers: PublicMapMarker[],
  maxMinutes: number,
  limit: number,
  selfId?: number,
): Nearby[] {
  const out: Nearby[] = [];
  const seenSpots: { lat: number; lng: number }[] = [];
  for (const marker of markers) {
    if (selfId !== undefined && marker.id === selfId) continue;
    const c = coord(marker);
    if (!c) continue;
    // 앵커와 같은 지점이면 걸어갈 곳이 아니라 지금 보고 있는 페이지의 중복 행이다.
    if (sameSpot(c, anchor)) continue;
    // 이미 채택한 이웃과 같은 지점이면(같은 건물의 중복 행) 건너뛴다.
    if (seenSpots.some((spot) => sameSpot(spot, c))) continue;
    seenSpots.push(c);
    const info = walkInfo(anchor.lat, anchor.lng, c.lat, c.lng);
    if (info.time > maxMinutes) continue;
    out.push({ marker, minutes: info.time, text: `도보 ${info.time}분` });
  }
  return out.sort((a, b) => a.minutes - b.minutes).slice(0, limit);
}
