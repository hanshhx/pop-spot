import { Marker } from "./types";
import { Popup } from "./types";

/**
 * 백엔드 API 베이스.
 *
 * 백엔드 호스트를 직접 부르지 않고 popspot.co.kr 을 거친다. 스토어 배포본에서는 이 문자열이 앱 안에 영구히
 * 박히는데, VM 교체나 네트워크 재설정으로 Tailscale funnel 주소가 바뀌면 설치된 앱이 전부 죽고 복구 수단이
 * 스토어 재심사(수일)밖에 없기 때문이다. popspot.co.kr 을 거치면 주소가 바뀌어도 Vercel 환경변수만 고치면
 * 이미 설치된 앱까지 즉시 복구된다.
 *
 * 경로는 그대로 쓴다 — popspot-frontend/next.config.ts 의 rewrite 가 `/api/:path*` 를
 * `${NEXT_PUBLIC_API_URL}/api/:path*` 로 그대로 넘긴다(프론트에 같은 경로의 route handler 는 없다).
 *
 * 로컬 개발에서 다른 서버를 보려면 `EXPO_PUBLIC_API_BASE` 로 덮는다. 배포본에는 이 값을 넣지 않는다 —
 * 빌드 타임에 박혀서 위의 문제가 그대로 돌아온다.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://popspot.co.kr";

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
