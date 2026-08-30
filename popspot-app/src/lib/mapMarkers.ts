import type { PopupStore } from '@/types/popup';

/**
 * 지도가 다루는 마커의 모양 — 웹 {@code src/lib/mapMarkers.ts} 와 같은 타입.
 *
 * <p><b>웹의 로더({@code loadMapMarkers})는 옮기지 않았다.</b> 웹은 목록({@code /api/popups})과
 * 마커({@code /api/map/markers})를 따로 받아 각각 캐시하는데, 앱은 {@code usePopups} 하나가 목록을
 * 들고 화면 전부가 그것을 나눠 쓴다. 같은 데이터를 두 번 받으면 355KB 를 이동통신망에서 두 번
 * 내려받는 셈이라 앱에서는 손해다.
 *
 * <p>그래서 남긴 것은 <b>타입과 변환기</b>다. 이 두 개가 있어야 웹에서 무수정으로 가져온
 * {@code mappable.ts} 가 그대로 돈다 — 그 파일이 이 모양을 받는다.
 *
 * <p>실측(2026-08-30): 두 엔드포인트가 같은 1,455건을 준다. 웹 주석은 {@code /api/map/markers} 가
 * 만료를 걸러 준다고 적어 두었지만 지금은 걸러 주지 않는다 — 날짜 판정을 서버에 맡기면 안 되고
 * {@code isOpenNow} 로 화면에서 걸러야 한다는 뜻이다.
 */
export interface PublicMapMarker {
  id: number;
  name: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  nameEn?: string | null;
  nameJa?: string | null;
  locationEn?: string | null;
  locationJa?: string | null;
}

/**
 * 목록의 팝업을 마커 모양으로.
 *
 * <p><b>값을 판정하지 않는다.</b> 없는 필드를 {@code null} 로 채우기만 하고, 좌표가 쓸 만한지는
 * {@code mappable()} 이 정한다. 웹의 같은 이름 함수와 한 줄씩 같다 — 웹은 이것을
 * {@code HomeClient} 와 랜딩 페이지 두 곳에 복사해 두고 "값 판정은 여기서 하지 않는다" 는 주석을
 * 양쪽에 달아 놓았는데, 앱에서는 한 곳에 둔다.
 */
export function popupToMapMarker(popup: PopupStore): PublicMapMarker {
  return {
    id: popup.id,
    name: popup.name,
    nameEn: popup.nameEn,
    nameJa: popup.nameJa,
    location: popup.location ?? null,
    locationEn: popup.locationEn,
    locationJa: popup.locationJa,
    latitude: popup.latitude ?? null,
    longitude: popup.longitude ?? null,
    category: popup.category ?? null,
    startDate: popup.startDate ?? null,
    endDate: popup.endDate ?? null,
  };
}
