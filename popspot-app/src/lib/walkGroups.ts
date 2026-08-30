/**
 * 도보 거리·시간과, 걸어서 다닐 만한 것끼리 묶기.
 *
 * <p>작전지도({@code app/planning/page.tsx})가 쓰던 산수를 그대로 옮긴 것이다. 그 화면의 도보
 * 시간은 <b>라우팅 API 에서 온 적이 없다</b> — OSRM 은 지도에 선을 그리려고만 부르고 응답의
 * duration·distance 는 버린다. 그래서 이 계산은 좌표만 있으면 되고, 랜딩 840 개에 얹어도 호출이
 * 0 번이다.
 *
 * <p>값을 바꾸지 않는다. 1.3 배와 분속 67m 는 작전지도가 쓰던 그대로다 — 두 화면이 같은 거리를
 * 다르게 말하면 어느 쪽도 믿을 수 없다.
 */

/** 두 좌표 사이의 도보 거리·시간. */
export interface WalkInfo {
  /** '723m' 처럼 1km 미만은 미터, 그 이상은 '1.5km' 처럼 소수 첫째 자리 킬로미터. */
  dist: string;
  /** 분 단위, 반올림. */
  time: number;
}

/**
 * 두 좌표 사이의 도보 거리·시간을 계산한다 (하버사인 × 1.3 도보 보정 ÷ 분속 67m).
 *
 * <p>{@code app/planning/page.tsx} 의 {@code calculateRouteInfo} 를 값 하나 바꾸지 않고 옮겼다.
 * 1.3 배는 직선거리와 실제 보행로의 차이를 보정하는 값이고, 분속 67m 는 성인 평균 도보 속도다.
 */
export function walkInfo(lat1: number, lng1: number, lat2: number, lng2: number): WalkInfo {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R * c;
  const walkingDist = distKm * 1.3;
  const minutes = Math.round((walkingDist * 1000) / 67);
  const distStr =
    walkingDist < 1 ? `${Math.round(walkingDist * 1000)}m` : `${walkingDist.toFixed(1)}km`;
  return { dist: distStr, time: minutes };
}

/** {@link walkGroups} 가 만들어 내는 한 묶음. */
export interface WalkGroup<T> {
  members: T[];
  /** 묶음 안에서 가장 먼 두 항목 사이의 도보 시간이 아니라, 첫 항목에서 각 항목까지의 최대 시간. */
  minutes: number;
}

/**
 * 걸어 다닐 만한 것끼리 묶는다. 좌표가 없는 항목은 지어내지 않고 뺀다.
 *
 * <p>묶는 방식은 단순 탐욕법이다: 아직 안 묶인 첫 항목을 기준으로 잡고, 그로부터 {@code maxMinutes}
 * 이내인 것을 전부 모아 한 묶음으로 만든 뒤, 남은 항목에서 반복한다. 최적 군집화(예: 모든 쌍을
 * 보고 가장 촘촘한 묶음을 고르는 방식)가 아니다 — 랜딩 페이지에 얹을 용도로는 그럴 필요가 없고,
 * 오히려 입력 순서만으로 결과가 결정되는 탐욕법 쪽이 테스트를 흔들리지 않게 만든다. 최적화를
 * 하면 "어느 쌍을 기준으로 삼을지"에 여러 정답이 생겨 같은 입력이 실행마다 다른 묶음을 낼 수
 * 있다.
 *
 * <p>혼자 남은 항목은 묶음으로 치지 않는다. "걸어서 묶기" 는 둘 이상이 함께 걸을 만할 때만 뜻이
 * 있고, 하나짜리 묶음은 그냥 "묶이지 않았다" 는 뜻이다.
 */
export function walkGroups<T>(
  items: T[],
  coord: (item: T) => { lat: number; lng: number } | null,
  /**
   * 기본값 15분. 작전지도의 분속 67m 로 15분이면 약 1km 인데, 그보다 멀면 "걸어서" 라고 부르기
   * 어렵다 — 그 지점부터는 대중교통이나 택시를 떠올리는 거리다.
   */
  maxMinutes = 15,
): WalkGroup<T>[] {
  const located = items
    .map((item) => ({ item, coord: coord(item) }))
    .filter((entry): entry is { item: T; coord: { lat: number; lng: number } } =>
      Boolean(entry.coord),
    );

  const groups: WalkGroup<T>[] = [];
  const used = new Array(located.length).fill(false);

  for (let i = 0; i < located.length; i++) {
    if (used[i]) continue;
    const anchor = located[i];
    const members: T[] = [anchor.item];
    let maxTime = 0;
    used[i] = true;

    for (let j = i + 1; j < located.length; j++) {
      if (used[j]) continue;
      const candidate = located[j];
      const { time } = walkInfo(
        anchor.coord.lat,
        anchor.coord.lng,
        candidate.coord.lat,
        candidate.coord.lng,
      );
      if (time <= maxMinutes) {
        members.push(candidate.item);
        maxTime = Math.max(maxTime, time);
        used[j] = true;
      }
    }

    if (members.length > 1) {
      groups.push({ members, minutes: maxTime });
    }
  }

  return groups;
}
