import type { PopupStore } from '@/types/popup';

/**
 * 좌표를 지도 상자 안의 자리로 — 시안이 핀을 퍼센트로 박아 둔 자리를 실제 데이터로 채운다.
 *
 * <p>시안은 핀 다섯 개를 {@code left:26%;top:40%} 처럼 손으로 찍어 두었다. 실제 팝업은 좌표가
 * 있으니 그 자리를 계산할 수 있다.
 *
 * <p><b>정확한 지도 투영이 아니다.</b> 서울 하나만 담는 상자라 메르카토르와 등장방형의 차이가
 * 화면에서 1px 도 안 되고, 애초에 이 바닥은 진짜 지도가 아니다({@code MapCanvas} 주석 참고).
 * MapLibre 를 얹는 날 이 파일은 통째로 사라진다 — 그때 지도가 투영을 직접 한다.
 */

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** 화면에서 핀 하나가 앉는 자리(0~1). */
export interface Placed {
  popup: PopupStore;
  x: number;
  y: number;
}

/** 문자열 좌표를 숫자로. 읽을 수 없으면 null — 지어내지 않는다. */
export function coordOf(popup: PopupStore): { lat: number; lng: number } | null {
  const lat = Number(String(popup.latitude ?? '').trim());
  const lng = Number(String(popup.longitude ?? '').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * 상자가 너무 납작해지지 않게 하는 최소 크기(도).
 *
 * <p>핀이 하나뿐이거나 전부 같은 좌표면 상자의 넓이가 0 이 되어 나눗셈이 무한대로 간다. 약 0.01도는
 * 1km 남짓 — 성수 한 동네가 화면에 꽉 차는 크기다.
 */
const MIN_SPAN = 0.01;

export function boundsOf(popups: PopupStore[]): Bounds | null {
  const coords = popups.map(coordOf).filter((c): c is { lat: number; lng: number } => c !== null);
  if (coords.length === 0) return null;

  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  let [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  let [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];

  if (maxLat - minLat < MIN_SPAN) {
    const mid = (maxLat + minLat) / 2;
    [minLat, maxLat] = [mid - MIN_SPAN / 2, mid + MIN_SPAN / 2];
  }
  if (maxLng - minLng < MIN_SPAN) {
    const mid = (maxLng + minLng) / 2;
    [minLng, maxLng] = [mid - MIN_SPAN / 2, mid + MIN_SPAN / 2];
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * 핀을 자리에 앉힌다.
 *
 * <p>가장자리에 여백을 둔다 — 상자 끝에 붙은 핀은 이름표가 화면 밖으로 잘린다. 시안의 핀도
 * 20%~76% 안에 들어와 있다.
 */
const PADDING = 0.12;

export function placePins(popups: PopupStore[], bounds: Bounds | null): Placed[] {
  if (!bounds) return [];
  const spanLat = bounds.maxLat - bounds.minLat;
  const spanLng = bounds.maxLng - bounds.minLng;
  const scale = 1 - PADDING * 2;

  return popups.flatMap((popup) => {
    const c = coordOf(popup);
    if (!c) return [];
    return [
      {
        popup,
        x: PADDING + ((c.lng - bounds.minLng) / spanLng) * scale,
        // 위도는 위로 갈수록 커지고 화면은 아래로 갈수록 커진다 — 뒤집는다.
        y: PADDING + ((bounds.maxLat - c.lat) / spanLat) * scale,
      },
    ];
  });
}
