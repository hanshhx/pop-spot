/**
 * 작전지도 방 시드로 넘길 형태로 다듬는다.
 *
 * <p>시드는 {@code `${name}|${lat}|${lng}`} 로 직렬화되고(`app/planning/page.tsx:415`) 서버가
 * {@code split("\\|", -1)} 로 되돌려 필드 수를 센다(`PlanningController.validateMarker`).
 * 그래서 <b>이름에 파이프가 있으면 필드 수가 4개가 되어 조용히 거절</b>된다 — 실제 데이터에
 * 「TOY STORY | PEACEMINUSONE : THE FIRST FAN」 같은 이름이 있다. 지우고 보낸다.
 *
 * <p>서버는 이름이 <b>100자를 넘어도</b> 통째로 거절한다({@code parts[0].length() > 100}).
 * 실측 1,181건 중 가장 긴 이름은 47자라 지금은 걸릴 일이 거의 없지만, 조용히 거절당해
 * 마커 하나가 이유 없이 방에서 빠지느니 미리 잘라 보내는 쪽이 안전하다. 자른 자리에 말줄임표는
 * 붙이지 않는다 — 이 이름은 화면에 보이는 라벨이 아니라 작전지도 마커 이름으로만 쓰이고,
 * 말줄임표 3자를 더하면 100자 한도를 다시 넘길 위험만 생긴다.
 */
export function toCourseSeed(
  items: { name: string; lat: number; lng: number }[],
): { name: string; lat: number; lng: number }[] {
  const MAX_NAME_LENGTH = 100;
  return items
    .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng))
    .map((i) => ({
      ...i,
      name: i.name.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim(),
    }))
    .filter((i) => i.name !== '');
}
