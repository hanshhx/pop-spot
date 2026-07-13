import { Marker } from "./types";
import { Popup } from "./types";

/**
 * 백엔드 API 베이스.
 *
 * 지금은 GCP VM(Tailscale funnel)을 직접 호출한다. 나중에 popspot.co.kr 프록시나 정식 API 도메인으로
 * 바꾸면 이 상수만 고치면 된다.
 */
export const API_BASE = "https://vm-113.tailc57dd4.ts.net";

/** 배경 영상(웹과 동일). CORS 허용 + 700KB 로 가벼워 스트리밍한다. */
export const BG_VIDEO_URL = "https://popspot.co.kr/light-bg.mp4";

/** 카드 피드용 팝업 목록(이미지 포함). */
export async function fetchPopups(): Promise<Popup[]> {
  const res = await fetch(`${API_BASE}/api/popups`);
  if (!res.ok) throw new Error(`popups ${res.status}`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (data?.content ?? []);
  return arr as Popup[];
}

/** 지도용 경량 마커(좌표 포함). 지도 탭에서 사용 예정. */
export async function fetchMarkers(): Promise<Marker[]> {
  const res = await fetch(`${API_BASE}/api/map/markers`);
  if (!res.ok) throw new Error(`markers ${res.status}`);
  const data = (await res.json()) as Marker[];
  return Array.isArray(data) ? data : [];
}
