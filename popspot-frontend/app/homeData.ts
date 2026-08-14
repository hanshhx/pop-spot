import type { PopupStore } from '@/types/popup';
import { emergencyMarkerToPopup, loadPublicMarkers } from '@/lib/emergencyPopupData';

/**
 * 홈이 <b>서버에서</b> 미리 받아 두는 팝업 목록.
 *
 * <p><b>왜 만들었나.</b> 홈은 마운트 뒤 {@code apiFetch('/api/popups')} 로 목록을 받았다. 그래서
 * 두 가지가 같이 나빴다.
 *
 * <ul>
 *   <li><b>느리다.</b> 백엔드는 집 VM 이고 Tailscale Funnel 을 거친다. 첫 화면이 그 왕복을 기다린다.
 *       {@code cached_popups} 로컬 캐시가 있지만 실측 재방문율이 사실상 0 이라 거의 모든 방문자가
 *       빈 캐시로 들어온다 — 캐시가 거의 아무도 못 구한다.
 *   <li><b>백엔드가 죽으면 홈이 빈다.</b> 2026-08-05 장애 때 실측하니 {@code /popups/seongsu} 는
 *       팝업 링크 31개를 그대로 내보냈는데(서버 렌더 + ISR) 홈은 0개였다. 같은 장애에서 한쪽만
 *       살아남은 이유가 정확히 이 차이다.
 * </ul>
 *
 * <p>덤으로 크롤러도 홈에서 팝업 목록을 보게 된다. 그전에는 홈 서버 HTML 의 {@code /popup/} 링크가
 * 0개였다.
 */

/**
 * {@code revalidate: 120} — 2분.
 *
 * <p>팝업 목록은 하루 단위로 바뀌므로 2분 지연은 아무도 알아채지 못한다. 그리고 이 값의 진짜
 * 역할은 <b>백엔드가 죽어 있는 동안 마지막 정상 응답을 계속 내보내는 것</b>이다. Next 는 재검증에
 * 실패하면 이전 캐시를 그대로 쓴다.
 *
 * <p>짧게 잡을수록 신선하지만 VM 을 자주 두드린다. 상세({@code revalidate: 300})보다 짧게 둔 것은
 * 홈이 "오늘 여는 팝업" 을 보여주는 자리라 마감·오픈이 늦게 반영되면 바로 티가 나기 때문이다.
 */
const REVALIDATE_SECONDS = 120;

/**
 * 서버에서 팝업 목록 가져오기.
 *
 * <p><b>실패하면 빈 배열</b>이고 예외를 던지지 않는다. 목록 하나 때문에 홈 전체를 500 으로 만들
 * 이유가 없다 — 그 경우 클라이언트가 평소처럼 다시 받아오고, 화면은 예전과 같은 동작으로 떨어진다.
 * 즉 이 함수는 <b>더 좋게 만들 뿐 더 나쁘게 만들지 않는다.</b>
 */
export async function fetchHomePopups(): Promise<PopupStore[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    const { markers } = await loadPublicMarkers(REVALIDATE_SECONDS);
    return markers.map(emergencyMarkerToPopup);
  }

  try {
    const res = await fetch(`${apiBase}/api/popups`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`popup list ${res.status}`);
    const raw = await res.json();
    if (Array.isArray(raw) && raw.length > 0) return raw as PopupStore[];
  } catch {
    // 아래 비상 목록으로 이어진다.
  }

  const { markers } = await loadPublicMarkers(REVALIDATE_SECONDS);
  return markers.map(emergencyMarkerToPopup);
}
