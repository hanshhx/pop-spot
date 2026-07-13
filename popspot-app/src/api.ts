import { Marker } from "./types";

/**
 * 백엔드 API 베이스.
 *
 * 지금은 GCP VM(Tailscale funnel)을 직접 호출한다. 나중에 popspot.co.kr 프록시나 정식 API 도메인으로
 * 바꾸면 이 상수만 고치면 된다.
 */
export const API_BASE = "https://vm-113.tailc57dd4.ts.net";

/** 진행 중(노출) 팝업 마커 전체. 실패 시 예외를 던져 화면에서 처리한다. */
export async function fetchMarkers(): Promise<Marker[]> {
  const res = await fetch(`${API_BASE}/api/map/markers`);
  if (!res.ok) throw new Error(`markers ${res.status}`);
  const data = (await res.json()) as Marker[];
  return Array.isArray(data) ? data : [];
}
