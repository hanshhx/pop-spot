import { getAuthToken } from '@/lib/authStorage';
import { bumpDropped, countsAsDrop, readDropped, settleDropped } from './beaconDrops';
import { getVisitorId } from '@/lib/visitorId';
import { apiUrl } from '@/lib/api';

/**
 * 방문 안에서 일어난 행동을 남긴다.
 *
 * <p>방문 비콘(VisitTracker)이 "어떤 페이지를 열었나" 를 남긴다면, 이쪽은 "그 안에서 무엇을 했나" 를
 * 남긴다. 목록을 훑기만 한 것과 카드를 눌러 상세를 연 것을 구분하기 위해서다.
 *
 * <p>개인정보 처리방침 제1조에 적힌 항목만 보낸다 — 익명 방문자 ID · 세션 ID · 행동 종류 ·
 * 대상 팝업 · 경로 · 회원/게스트 구분. 회원 식별자는 보내지 않는다.
 */

const SESSION_KEY = 'popspot:sessionId';
const SESSION_TOUCHED_KEY = 'popspot:sessionTouchedAt';

/** 이만큼 활동이 없으면 새 방문으로 본다. 방침에 "30분" 으로 고지했다. */
const SESSION_IDLE_MS = 30 * 60 * 1000;

/**
 * 서버가 받아들이는 행동 종류. 여기 없는 값은 서버가 버린다 — 양쪽 목록을 함께 고쳐야 한다.
 * (백엔드는 {@code VisitEvent.ALLOWED_TYPES})
 *
 * <p>{@code wishlist_add} · {@code outbound_click} 은 C-4 퍼널의 뒤쪽 두 단계다. 그전에는
 * 수집하지 않아서 "목록 → 상세" 까지밖에 그릴 수 없었다.
 */
export type VisitEventType =
  'popup_open' | 'detail_view' | 'map_search' | 'popup_share' | 'wishlist_add' | 'outbound_click';

/**
 * 이번 방문의 세션 ID.
 *
 * <p><code>sessionStorage</code>에 둔다 — 탭을 닫으면 사라진다. 그리고 30분간 활동이 없으면 새 값으로
 * 바꾼다. 방문을 묶으면 한 사람의 행적이 이어져 식별 가능성이 올라가므로, 묶는 범위를 짧게 끊는다.
 */
function currentSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const now = Date.now();
    const touchedAt = Number(window.sessionStorage.getItem(SESSION_TOUCHED_KEY) ?? 0);
    const existing = window.sessionStorage.getItem(SESSION_KEY);

    const fresh = existing && now - touchedAt < SESSION_IDLE_MS;
    const id = fresh ? existing : crypto.randomUUID();

    window.sessionStorage.setItem(SESSION_KEY, id);
    window.sessionStorage.setItem(SESSION_TOUCHED_KEY, String(now));
    return id;
  } catch {
    // sessionStorage 를 못 쓰면(시크릿·차단) 세션 묶기를 포기한다. 행동 자체는 기록된다.
    return null;
  }
}

/** 관리자·운영자 본인 트래픽인가 — 방문 비콘과 <b>같은 기준</b>이어야 두 숫자가 어긋나지 않는다. */
function isOwnTraffic(path: string): boolean {
  try {
    if (path.startsWith('/admin')) return true;
    if (localStorage.getItem('popspot:notrack') === '1') return true;
  } catch {
    /* 판정 실패 시 정상 기록 */
  }
  return false;
}

/**
 * 행동 하나를 서버에 남긴다. 실패는 조용히 무시한다.
 *
 * <p>화면 흐름을 절대 막지 않는다 — 통계가 한 건 빠지는 것보다 카드 클릭이 느려지는 쪽이 나쁘다.
 * 그래서 await 하지 않고, 페이지가 바뀌어도 전송이 끊기지 않게 {@code keepalive} 를 쓴다.
 */
/**
 * 페이지가 떠나는 중인가.
 *
 * <p>{@code keepalive} 요청은 문서가 사라져도 브라우저가 전송을 끝내지만, 그 사이 문서가 없어지면
 * 이쪽 promise 는 abort 로 거절된다. 그것을 손실로 세면 <b>정상 이동마다 유실이 하나씩 쌓인다</b>.
 *
 * <p>{@code pagehide} 를 쓰는 이유 — 뒤로가기 캐시(bfcache)로 들어갈 때도 불린다. 그리고 캐시에서
 * 되살아나면 {@code pageshow} 가 다시 열어 준다. 안 열면 그 탭은 그 뒤로 진짜 실패도 안 센다.
 */
let unloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    unloading = true;
  });
  window.addEventListener('pageshow', () => {
    unloading = false;
  });
}

/** {@code localStorage} 접근 자체가 막힌 브라우저가 있다. 없으면 계수기는 조용히 쉰다. */
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function trackVisitEvent(
  type: VisitEventType,
  options: { popupId?: number | string | null; path?: string } = {},
): void {
  if (typeof window === 'undefined') return;

  const path = options.path ?? window.location.pathname;
  if (isOwnTraffic(path)) return;

  let guest = true;
  try {
    guest = !getAuthToken();
  } catch {
    /* 접근 불가 시 게스트로 간주 */
  }

  /*
   * 지금까지 못 보낸 비콘 수를 함께 실어 보낸다. 서버가 살아나는 첫 요청에 그동안의 손실이
   * 따라 들어가므로, 별도 보고 경로가 없어도 유실이 드러난다(beaconDrops 참고).
   */
  const storage = safeStorage();
  const dropped = readDropped(storage);

  const body = JSON.stringify({
    visitorId: getVisitorId(),
    sessionId: currentSessionId(),
    type,
    ...(options.popupId != null ? { popupId: options.popupId } : {}),
    path: path.slice(0, 255),
    guest,
    ...(dropped > 0 ? { dropped } : {}),
  });

  try {
    /*
     * 주소는 반드시 apiUrl 로 만든다. 예전에는 백엔드 기본 주소를 직접 이어 붙였는데, 운영에서
     * 그 값이 Tailscale 호스트(vm-113.*.ts.net)라 <b>tailnet 밖의 방문자에게는 언제나
     * TypeError: Failed to fetch</b> 였다. 같은 페이지의 페이지뷰 비콘은 apiUrl 을 써서 멀쩡히
     * 204 를 받고 있었으므로, 행동 이벤트만 조용히 통째로 사라졌다.
     */
    void fetch(apiUrl('/api/visits/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      // 카드를 누르면 곧바로 화면이 바뀐다. keepalive 가 없으면 이동과 함께 요청이 취소돼
      // 정작 세려던 클릭이 안 잡힌다.
      keepalive: true,
    })
      .then((res) => {
        /*
         * fetch 는 500 에도 resolve 한다. res.ok 를 안 보면 백엔드가 죽어 있어도 "보냈다" 로
         * 여겨져, 기록이 통째로 비는 구간이 아무 신호 없이 지나간다(2026-08-13~19 이 그랬다).
         */
        if (res.ok) settleDropped(storage, dropped);
        else bumpDropped(storage);
      })
      .catch((error: unknown) => {
        /*
         * 사용자에게 알릴 일은 아니지만 잃었다는 사실은 남긴다 — 페이지가 떠나면서 끊긴 것만
         * 뺀다. 그건 서버가 이미 받았을 수 있다(countsAsDrop 에 경위).
         */
        if (countsAsDrop(error, unloading)) bumpDropped(storage);
      });
  } catch (error) {
    /* fetch 자체가 막힌 환경 */
    if (countsAsDrop(error, unloading)) bumpDropped(storage);
  }
}
