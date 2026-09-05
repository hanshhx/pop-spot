/**
 * 비회원 때 담아 둔 찜을 로그인한 계정으로 옮긴다.
 *
 * <p><b>왜 파일을 따로 뺐나.</b> 이 로직은 원래 {@code app/popup/[id]/PopupDetailClient.tsx} 안의
 * useEffect 하나였다. 그런데 로그인 성공 경로는 전부 {@code /?entered=1}(홈)이다 — 이메일
 * (app/login/page.tsx:119), 2단계 인증(:258), 소셜 콜백(app/oauth/callback/page.tsx:195, :252).
 * 즉 <b>평범하게 로그인하면 상세 페이지를 지나지 않으므로 이전이 한 번도 돌지 않았다.</b> 담아 둔
 * 것은 브라우저에 그대로 남는데 홈 MY 탭은 로그인하는 순간 게스트 목록 렌더를 멈춰서
 * (HomeClient 의 {@code if (currentTab !== 'MY' || user) return;}) 사용자에게는 "가입했더니 찜이
 * 사라졌다" 로 보인다. 화면에 붙어 있으면 그 화면을 지나야만 도는 게 문제라서, 화면에서 떼어
 * 인증이 확정되는 자리(AuthGuard)에서 부르게 했다.
 *
 * <p><b>서버 POST 는 멱등이 아니다 — 토글이다.</b> 이 파일이 존재하는 진짜 이유가 이것이다.
 * {@code POST /api/wishlist/{userId}/{popupId}} 는 없으면 담고 <b>있으면 지운다</b>
 * (WishlistService#toggleWishlist). 예전 코드는 "서버 찜은 멱등이라 두 번 올려도 결과는 같다" 는
 * 잘못된 전제 위에 있었고, 그래서 <b>이미 서버에 있는 팝업을 이전하면 지워 버렸다.</b> 응답이
 * 200 이라 실패로도 안 잡혀 게스트 사본까지 함께 사라졌다.
 *
 * <p><b>그래서 멱등성을 프론트에서 만든다.</b> 순서가 전부다.
 *
 * <ol>
 *   <li>저장소를 <b>읽기만</b> 한다. 비우지 않는다 — 예전에는 네트워크보다 먼저 비워서 중간에
 *       탭이 닫히면 되돌릴 것 자체가 없었다.
 *   <li>{@code GET /api/wishlist/{userId}} 로 서버에 이미 있는 것을 먼저 받는다. <b>이 조회가
 *       실패하면 아무것도 하지 않고 끝낸다.</b> 서버 상태를 모르는 채 POST 하는 것이 위에 적은
 *       사고의 정확한 원인이라, 이 GET 이 이 설계의 유일한 안전장치다.
 *   <li>교집합(이미 있는 것)은 <b>절대 POST 하지 않는다.</b> 성공으로 간주한다.
 *   <li>차집합만 4개씩 나눠 POST 한다. 응답 <b>본문</b>이 ADDED/REMOVED 를 알려주므로, REMOVED 가
 *       오면 조회 이후에 다른 탭이 먼저 넣은 것을 방금 지웠다는 뜻이다 — 곧바로 한 번 더 눌러
 *       되돌리고, 그런 경합이 있었으면 마지막에 서버에 다시 물어 확정한다.
 *   <li>저장소는 <b>맨 마지막에 한 번만</b> 손댄다. 그것도 <b>서버에 있다는 증거가 있는 id 만</b>
 *       뺀다. 옮기는 동안 사용자가 새로 담은 것을 덮어쓰지 않도록 저장소를 다시 읽고 뺀다.
 * </ol>
 *
 * <p>이 규칙 덕분에 <b>몇 번을 다시 돌려도 안전하다.</b> 성공한 것은 저장소에서 빠져 다음 번엔
 * 후보에 없고, 실패한 것은 남아 다음 번 3)의 교집합 판정을 다시 받는다. 응답만 잃어버린
 * 요청(502·타임아웃)도 다음 번 GET 에서 "이미 있음" 으로 잡혀 두 번 눌리지 않는다.
 *
 * <p><b>남는 한계.</b> 이것은 <b>재실행에 대해 멱등</b>이지 <b>원자적이지 않다.</b> GET 과 POST
 * 사이의 창은 REMOVED 되돌리기로 흡수할 뿐 없앨 수는 없다. 완전히 닫으려면 서버에 "있으면 그냥
 * 둔다" 한 방(멱등 PUT)이 있어야 하고 그건 백엔드 배포가 필요하다.
 */

import { apiFetch } from './api';
import { getAuthToken } from './authStorage';
import { forgetGuestWishlist, readGuestWishlist } from './guestWishlist';

/**
 * 이전이 끝나 서버 목록이 바뀌었음을 알린다.
 *
 * <p>이전은 AuthGuard(루트 레이아웃)에서 도는데 찜을 그리는 화면은 홈 MY 탭과 상세 하트다. 그
 * 화면들은 자기 마운트 시점에 서버를 한 번 읽고 React state 로 들고 있어서, 이전이 나중에 끝나면
 * 새로고침 전까지 옛 값을 보여 준다. {@code AUTH_EXPIRED_EVENT}(api.ts) 가 같은 문제를 같은
 * 방법으로 풀고 있어 그 모양을 그대로 따른다.
 */
export const GUEST_WISHLIST_MIGRATED_EVENT = 'popspot:guest-wishlist-migrated';

/**
 * 동시에 보낼 POST 개수.
 *
 * <p>순차로 최대 100번 await 하면 로그인 직후 화면이 오래 어긋나 있고, 반대로 100개를 한꺼번에
 * 던지면 (1) 우리 프록시가 Vercel 서버리스 호출 100건을 한 틱에 받고 (2) 중간에 502 가 나서
 * apiFetch 가 이 탭을 'unavailable' 로 판정해도 이미 다 떠난 뒤라 그 차단이 한 건도 안 걸린다.
 * 4개씩 흘려보내면 판정이 걸린 순간부터 남은 요청이 즉시 503(ok=false)으로 끝나 실패로 잡히고
 * 저장소에 남는다.
 */
const POST_CONCURRENCY = 4;

/**
 * 실패한 이전을 <b>자동으로</b> 다시 시도하기까지의 최소 간격.
 *
 * <p><b>이 값만 보고 "1분 뒤 다시 된다" 고 읽으면 안 된다.</b> 자동 재시도의 계기는 AuthGuard
 * effect 의 재실행뿐이고 그 deps 는 {@code pathname} 이다. 로그인은 언제나 홈에 착지하는데
 * 홈의 탭 전환은 주소를 바꾸지 않으므로, 홈에 머무르는 사용자에게는 <b>계기 자체가 오지 않는다.</b>
 * 실질적인 재시도 경로는 둘이다 — 다른 페이지로 이동, 또는 사용자가 직접
 * {@link retryGuestWishlistMigration} 을 부르는 것(화면의 "다시 시도").
 */
const RETRY_COOLDOWN_MS = 60_000;

/**
 * 한 번 열린 페이지에서 시도할 수 있는 최대 횟수.
 *
 * <p>약관 재동의가 밀린 계정은 POST 가 계속 428 로 떨어진다(PolicyConsentInterceptor 는 GET 만
 * 면제한다). 쿨다운만 있으면 그런 계정이 사이트를 오래 돌아다닐 때 1분마다 요청이 다시 나간다.
 * 인프라 비용이 0원이어야 하는 서비스라 상한을 함께 둔다 — 이 상한에 걸려도 목록은 저장소에
 * 그대로 남아 다음 방문에서 다시 시도한다.
 */
const MAX_ATTEMPTS_PER_PAGE_LOAD = 5;

/** 탭 사이의 동시 실행을 막는 Web Locks 이름. */
const TAB_LOCK_NAME = 'popspot:guest-wishlist-migration';

/** 이번 이전이 무엇을 했는지. 호출부는 보통 무시하지만 시험과 콘솔 진단이 이 값을 본다. */
export type MigrationOutcome = {
  /** 이번에 서버로 새로 올린 개수. */
  moved: number;
  /** 서버에 이미 있어 손대지 않은 개수. */
  already: number;
  /** 못 옮겨 저장소에 남긴 개수. */
  failed: number;
  /**
   * 서버에 올리기는 했는데 <b>확정을 못 지은</b> 채 끝났는가.
   *
   * <p>경합이 있으면 마지막에 서버에 다시 물어 확정하는데, 그 조회마저 실패하면 아무것도 지우지
   * 않고 끝낸다(안전한 선택이다 — 다시 돌려도 되니까). 그때 {@code moved} 는 올린 것을 그대로
   * 세지만 저장소는 아직 그대로라, 다음 실행에서 같은 것이 "이미 있음" 으로 한 번 더 잡힌다.
   * 진단할 때 그 차이를 설명하는 값이다.
   */
  unconfirmed: boolean;
  /**
   * 아무것도 하지 않고 끝낸 이유.
   * - {@code no-token}: 이 탭에는 토큰이 없다(다른 탭에서 로그인한 경우 등).
   * - {@code empty}: 옮길 것이 없다.
   * - {@code busy}: 다른 탭·같은 탭의 다른 실행이 이미 하고 있다, 또는 시도 상한에 걸렸다.
   * - {@code list-failed}: 서버 목록 조회가 실패했다. 저장소는 손대지 않았다.
   */
  skipped: 'no-token' | 'empty' | 'busy' | 'list-failed' | null;
};

const skipOutcome = (reason: NonNullable<MigrationOutcome['skipped']>): MigrationOutcome => ({
  moved: 0,
  already: 0,
  failed: 0,
  unconfirmed: false,
  skipped: reason,
});

/** 같은 탭에서 동시에 두 번 돌지 않게. StrictMode 이중 호출·빠른 경로 이동이 여기 걸린다. */
let inFlight: Promise<MigrationOutcome> | null = null;

/** userId 별 마지막 시도 시각과 횟수. 모듈 수명 = 페이지 수명이라 새로고침하면 초기화된다. */
const attempts = new Map<string, { at: number; count: number }>();

/**
 * 이전을 시도한다. 이미 돌고 있거나 방금 실패했으면 조용히 건너뛴다.
 *
 * <p><b>호출부에 가드를 두지 않아도 되도록</b> 중복 방지를 이 안에서 한다. AuthGuard 의 effect 는
 * deps 에 pathname 이 있어 경로가 바뀔 때마다 다시 도는데, 그 가드를 호출부에 두면 이전을 부르는
 * 자리가 늘어날 때마다 같은 규칙을 다시 써야 하고 한 곳만 빠뜨려도 토글이 뒤집힌다.
 */
export function migrateGuestWishlist(userId: string): Promise<MigrationOutcome> {
  if (inFlight) return inFlight;
  if (!userId) return Promise.resolve(skipOutcome('busy'));

  // 로그인 판정을 localStorage['user'] 로 하지 않는다. 토큰은 sessionStorage(탭 단위)인데 user
  // 캐시는 localStorage(탭 공유)라, 다른 탭에서 로그인하면 이 탭에서도 "로그인한 것처럼" 보인다.
  // 그 탭이 이전을 시작하면 토큰 없이 POST 만 잔뜩 보내게 된다.
  if (!getAuthToken()) return Promise.resolve(skipOutcome('no-token'));
  if (readGuestWishlist().length === 0) return Promise.resolve(skipOutcome('empty'));

  const now = Date.now();
  const prev = attempts.get(userId);
  if (prev && (now - prev.at < RETRY_COOLDOWN_MS || prev.count >= MAX_ATTEMPTS_PER_PAGE_LOAD)) {
    return Promise.resolve(skipOutcome('busy'));
  }
  attempts.set(userId, { at: now, count: (prev?.count ?? 0) + 1 });

  inFlight = start(userId);
  return inFlight;
}

/**
 * 사용자가 <b>직접</b> 다시 시도한다. 쿨다운과 시도 상한을 건너뛴다.
 *
 * <p><b>왜 우회가 정당한가.</b> 쿨다운({@link RETRY_COOLDOWN_MS})과 시도 상한은 "아무도 안
 * 시켰는데 자동으로 다시 나가는" 요청을 막으려고 있다. 0원 인프라에서 실패가 반복되는 계정이
 * 배경에서 계속 요청을 쏘면 안 되기 때문이다. 사람이 버튼을 눌렀다면 그 이유가 사라진다 —
 * 빈도는 손가락이 정하고, 실패를 본 당사자가 다시 하겠다고 한 것이다.
 *
 * <p>이 문이 필요한 이유는 <b>자동 재시도 계기가 사실상 없기 때문</b>이다. 이전은 AuthGuard 의
 * effect 에서 도는데 그 deps 는 {@code pathname} 이다. 그런데 로그인은 언제나 홈에 착지하고,
 * 홈의 MY·코스·여권은 <b>주소가 아니라 탭</b>이라 아무리 눌러도 {@code pathname} 이 '/' 그대로다.
 * 즉 실패한 이전은 사용자가 스스로 다른 페이지로 나가거나 새로고침하기 전까지 다시 돌지 않는다.
 */
export function retryGuestWishlistMigration(userId: string): Promise<MigrationOutcome> {
  attempts.delete(userId);
  return migrateGuestWishlist(userId);
}

/** 시험 전용 — 모듈 수명 동안 남는 중복 방지 상태를 지운다. */
export function __resetMigrationGuardsForTest(): void {
  inFlight = null;
  attempts.clear();
}

async function start(userId: string): Promise<MigrationOutcome> {
  try {
    return await withTabLock(() => run(userId));
  } finally {
    inFlight = null;
  }
}

/**
 * 탭 사이의 동시 실행을 막는다.
 *
 * <p>게스트 목록은 localStorage 라 모든 탭이 공유한다. 브라우저를 다시 열어 탭 여러 개가 한꺼번에
 * 살아나면 두 탭이 같은 목록을 동시에 올릴 수 있고, 서버 POST 가 토글이라 <b>두 번 = 지워짐</b>이
 * 된다. GET 선조회와 REMOVED 되돌리기가 그 대부분을 흡수하지만, 애초에 겹치지 않게 하는 편이 싸다.
 *
 * <p><b>기다리지 않고 건너뛴다</b>({@code ifAvailable}). 기다리면 앞선 탭이 apiFetch 의 12초
 * 타임아웃을 다 쓰는 동안 이 탭도 같이 멈춘다. 건너뛰어도 목록은 저장소에 그대로 남아 다음
 * 기회에 다시 돈다 — 이 설계에서 "나중에 다시" 는 언제나 안전하다.
 *
 * <p>Web Locks 가 없는 브라우저에서는 잠금 없이 그냥 실행한다. 잠금이 없다고 이전을 포기하면
 * 그 브라우저 사용자는 영영 못 옮긴다 — 위 두 안전장치가 남아 있으므로 실행하는 편이 낫다.
 */
async function withTabLock(task: () => Promise<MigrationOutcome>): Promise<MigrationOutcome> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks || typeof locks.request !== 'function') return task();
  try {
    const granted: MigrationOutcome | null = await locks.request(
      TAB_LOCK_NAME,
      { ifAvailable: true },
      async (lock) => (lock ? await task() : null),
    );
    return granted ?? skipOutcome('busy');
  } catch {
    // 잠금 자체가 실패하는 환경(권한·정책)이 있다. 그때는 잠금 없이 진행한다.
    return task();
  }
}

async function run(userId: string): Promise<MigrationOutcome> {
  // 중복을 먼저 걷어낸다. 저장소는 담을 때 중복을 막지만(toggleGuestWishlist), 손으로 넣거나
  // 옛 버전이 남긴 값에는 같은 id 가 두 번 있을 수 있다. 그대로 두면 같은 팝업에 POST 가 두 번
  // 나가고 — 서버가 토글이라 — 담았다가 도로 지운다. 아래 REMOVED 되돌리기가 흡수하긴 하지만,
  // 애초에 보내지 않는 편이 싸고 세는 숫자도 맞는다.
  const pending = [...new Set(readGuestWishlist())];
  if (pending.length === 0) return skipOutcome('empty');

  const serverIds = await fetchServerIds(userId);
  // 서버에 무엇이 있는지 모르면 아무것도 하지 않는다. 여기서 그냥 POST 하면 이미 찜한 팝업을
  // 지워 버리는 바로 그 사고가 재발한다. 저장소를 손대지 않았으므로 다음 계기에 다시 돈다 —
  // 다른 페이지로의 이동이나 새로고침, 또는 화면의 "다시 시도"({@link retryGuestWishlistMigration}).
  // 홈에 머무르는 동안에는 계기가 오지 않는다(RETRY_COOLDOWN_MS 주석 참고).
  // 이것도 알린다. 옮길 것이 남아 있는데 한 건도 못 옮긴 상태이므로, 화면이 "찜한 팝업이 없습니다"
  // 대신 사실을 말할 수 있어야 한다.
  if (!serverIds) return announce(skipOutcome('list-failed'));

  const already = pending.filter((id) => serverIds.has(id));
  const missing = pending.filter((id) => !serverIds.has(id));

  const added = new Set<number>();
  const failed = new Set<number>();
  let raced = false;

  await pooled(missing, POST_CONCURRENCY, async (id) => {
    const first = await postToggle(userId, id);
    if (first === 'ADDED') {
      added.add(id);
      return;
    }
    if (first !== 'REMOVED') {
      failed.add(id);
      return;
    }
    // 조회 이후에 다른 탭·다른 기기가 먼저 넣어 둔 것을 방금 지웠다. 서버가 결과를 본문으로
    // 알려주는 덕분에 우리가 우리 실수를 알아챌 수 있다 — 곧바로 되돌린다.
    raced = true;
    const second = await postToggle(userId, id);
    if (second === 'ADDED') added.add(id);
    else failed.add(id);
  });

  const confirmed = raced
    ? // 경합이 있었으면 짐작으로 끝내지 않는다. 되돌리기까지 마친 뒤 서버에 다시 물어, 실제로
      // 남아 있는 것만 저장소에서 뺀다. 그 조회마저 실패하면 <b>아무것도 빼지 않는다</b> —
      // 확신 없이 지우는 것보다 한 번 더 옮기는 편이 낫고, 다시 돌려도 안전한 설계다.
      await confirmByReread(userId, pending)
    : new Set([...already, ...added]);

  forgetGuestWishlist([...confirmed]);

  // 실제로 무슨 일이 있었는지는 위 집합들이 이미 알고 있다. 빼기로 역산하지 않는다 — 예전에는
  // failed 를 pending.length - confirmed.size 로 구했는데, 경합 뒤 재조회가 실패하면 확정을
  // 포기하느라 confirmed 가 비므로 <b>멀쩡히 올라간 것까지 실패로 셌다.</b> 장애를 볼 때 이 숫자를
  // 믿는데 그러면 성공한 이전을 실패로 읽는다.
  //
  // 저장소를 비울지 정하는 것(confirmed)과 무슨 일이 있었는지 보고하는 것은 별개다. 앞은 확신이
  // 없으면 안 지우는 쪽으로 기울어야 하고, 뒤는 사실대로여야 한다.
  return announce({
    moved: added.size,
    already: already.length,
    failed: failed.size,
    unconfirmed: raced && confirmed.size < already.length + added.size,
    skipped: null,
  });
}

/**
 * 끝났다고 알린다. <b>결과와 무관하게 언제나 쏜다.</b>
 *
 * <p>예전에는 저장소에서 실제로 뺀 것이 있을 때만 쏘았는데, 그러면 정작 알려야 할 두 경우가
 * 조용히 지나갔다. <b>(1)</b> 서버에는 올렸지만 확정 재조회가 실패해 저장소를 못 비운 경우 —
 * 화면은 옛 목록을 그대로 들고 있는데 서버는 바뀌었다. <b>(2)</b> 전부 실패한 경우 — 화면은
 * "찜한 팝업이 없습니다" 를 띄우고 있는데 저장소에는 그대로 남아 있다. 그게 이 코드가 고치려던
 * 바로 그 화면이라, 실패했을 때야말로 화면이 알아야 한다.
 *
 * <p>{@code detail} 로 결과를 함께 넘긴다 — 받는 쪽이 "옮기는 중" · "N건 못 옮김" · "정말 없음"
 * 을 구분해야 하는데, 그 판단에 필요한 것은 여기밖에 모른다.
 */
function announce(outcome: MigrationOutcome): MigrationOutcome {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GUEST_WISHLIST_MIGRATED_EVENT, { detail: outcome }));
  }
  return outcome;
}

/* ============================== 내부 헬퍼 ============================== */

/**
 * 서버에 지금 담겨 있는 팝업 id.
 *
 * <p>실패(네트워크·403·5xx)와 "비어 있음" 을 반드시 구분해야 한다 — 빈 목록으로 착각하면 전부
 * POST 해서 이미 있던 것을 지운다. 그래서 실패는 {@code null} 이다.
 */
async function fetchServerIds(userId: string): Promise<Set<number> | null> {
  try {
    const res = await apiFetch(`/api/wishlist/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return null;
    const ids = rows
      .map((row) => Number((row as { popupId?: unknown }).popupId))
      .filter((id) => Number.isInteger(id) && id > 0);
    return new Set(ids);
  } catch {
    return null;
  }
}

/** 경합 뒤 확정용 재조회. 조회가 실패하면 빈 집합 — 저장소를 한 건도 건드리지 않는다. */
async function confirmByReread(userId: string, pending: number[]): Promise<Set<number>> {
  const after = await fetchServerIds(userId);
  if (!after) return new Set<number>();
  return new Set(pending.filter((id) => after.has(id)));
}

type ToggleResult = 'ADDED' | 'REMOVED' | 'FAILED';

/**
 * 찜 토글 한 번.
 *
 * <p>상태 코드만으로는 담긴 것인지 지워진 것인지 알 수 없다 — 둘 다 200 이다. <b>본문</b>이
 * ADDED/REMOVED 를 준다(WishlistService). 알 수 없는 본문은 실패로 본다: 저장소에 남겨 두면
 * 다음 번 조회가 진실을 알려주므로, 넘겨짚는 것보다 안전하다.
 */
async function postToggle(userId: string, popupId: number): Promise<ToggleResult> {
  try {
    const res = await apiFetch(`/api/wishlist/${encodeURIComponent(userId)}/${popupId}`, {
      method: 'POST',
    });
    if (!res.ok) return 'FAILED';
    const body = (await res.text()).trim();
    if (body === 'ADDED') return 'ADDED';
    if (body === 'REMOVED') return 'REMOVED';
    return 'FAILED';
  } catch {
    return 'FAILED';
  }
}

/** 동시성 제한 실행기. 자바스크립트는 한 줄씩 도므로 cursor 증가만으로 겹치지 않는다. */
async function pooled<T>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await work(item);
    }
  });
  await Promise.all(lanes);
}
