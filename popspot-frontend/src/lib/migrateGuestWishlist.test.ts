// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GUEST_WISHLIST_KEY, readGuestWishlist, toggleGuestWishlist } from './guestWishlist';
import { setServiceAvailability } from './serviceAvailability';
import {
  GUEST_WISHLIST_MIGRATED_EVENT,
  __resetMigrationGuardsForTest,
  migrateGuestWishlist,
  retryGuestWishlistMigration,
} from './migrateGuestWishlist';
import type { MigrationOutcome } from './migrateGuestWishlist';

/**
 * <b>이 시험이 지키는 것은 하나다 — 옮기다가 잃지 않는다.</b>
 *
 * <p>예전 이전기는 서버 찜이 멱등이라고 믿었다. 아니다. {@code POST /api/wishlist/{u}/{p}} 는
 * 토글이라 <b>이미 있는 것을 올리면 지운다</b>. 그래서 실제로 이런 일이 있었다 —
 *
 * <ul>
 *   <li>서버에 이미 찜해 둔 팝업이 이전 도중 <b>삭제됐다.</b> 200 이 와서 실패로도 안 잡혔고,
 *       게스트 사본은 이미 비워진 뒤라 되돌릴 것도 없었다.
 *   <li>이전이 두 번 돌면 상태가 <b>뒤집혔다.</b>
 *   <li>저장소를 네트워크보다 먼저 비워서, 중간에 탭이 닫히면 그대로 소실이었다.
 * </ul>
 *
 * <p>아래 시험들은 그 셋이 다시는 일어나지 않는지를 <b>가짜 서버</b>로 확인한다. 가짜 서버도
 * 진짜와 똑같이 토글로 동작한다 — 멱등한 서버를 가정하면 시험이 통과해도 아무것도 못 지킨다.
 */

const USER = 'u-1';

/** 진짜 백엔드와 같은 규칙으로 도는 가짜 서버. POST 는 토글이고 결과를 본문으로 알려준다. */
function fakeServer(initial: number[] = []) {
  const rows = new Set<number>(initial);
  const posts: number[] = [];
  const listCalls: number[] = [];
  let inFlight = 0;
  let peakInFlight = 0;

  const behavior = {
    /**
     * 목록 조회를 실패시킨다.
     *
     * <p>403 을 쓰는 이유가 있다. 이 저장소의 apiFetch 는 502/503/504 를 GET 에 한해 네 번까지
     * 다시 보내고(RETRY_DELAYS_MS) 그 뒤 탭을 30초간 'unavailable' 로 잠근다. 시험에서 그것까지
     * 재현하면 한 건에 5초가 걸리고 잠금이 뒷 시험으로 새어 나간다. 여기서 확인하려는 것은
     * "조회가 실패하면 아무것도 하지 않는다" 이지 재시도 정책이 아니므로, 한 방에 끝나는 실패를
     * 쓴다. 미인증·본인 아님(requireSelf)이 실제로 403 이라 현실적인 값이기도 하다.
     */
    listFails: false,
    /** POST 를 실패시킬 id. 428(약관 재동의)·502 등. */
    postFails: new Set<number>(),
    /**
     * 이 id 의 <b>첫</b> POST 직전에 다른 탭이 먼저 넣은 것으로 친다 — 우리 POST 는 REMOVED 가 된다.
     */
    raceBefore: new Set<number>(),
    /** POST 가 서버에 닿는 순간 바깥에서 끼어들 자리(예: 그 사이에 사용자가 새로 담기). */
    onPost: undefined as ((id: number) => void) | undefined,
  };

  const handler = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);
    try {
      // 목록 조회: /api/wishlist/{userId}
      const list = /\/api\/wishlist\/[^/]+$/.exec(url);
      if (list) {
        listCalls.push(rows.size);
        if (behavior.listFails) return new Response('forbidden', { status: 403 });
        return Response.json([...rows].map((popupId) => ({ popupId })));
      }
      // 토글: /api/wishlist/{userId}/{popupId}
      const toggle = /\/api\/wishlist\/[^/]+\/(\d+)$/.exec(url);
      if (toggle) {
        const id = Number(toggle[1]);
        posts.push(id);
        behavior.onPost?.(id);
        // 진짜로 한 번 양보한다. 이게 없으면 이 핸들러가 동기로 끝나 레인이 겹치지 않고,
        // peakInFlight 가 언제나 1 이라 "동시에 4개까지" 단언이 무엇을 걸든 통과해 버린다.
        // (POST_CONCURRENCY 를 1 로 낮춰도 초록불이었다 — 지키는 것이 없는 시험이었다.)
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (behavior.postFails.has(id)) return new Response('428', { status: 428 });
        if (behavior.raceBefore.has(id)) {
          behavior.raceBefore.delete(id);
          rows.add(id); // 다른 탭이 방금 넣었다
        }
        if (rows.has(id)) {
          rows.delete(id);
          return new Response('REMOVED', { status: 200 });
        }
        rows.add(id);
        return new Response('ADDED', { status: 200 });
      }
      return new Response('not found', { status: 404 });
    } finally {
      inFlight -= 1;
    }
  };

  vi.spyOn(globalThis, 'fetch').mockImplementation(handler as typeof fetch);
  return {
    rows,
    posts,
    listCalls,
    behavior,
    peak: () => peakInFlight,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.sessionStorage.setItem('token', 'jwt-for-test');
  // 장애 판정은 모듈 전역이라 시험 사이에 새어 나간다 — 'unavailable' 이 남아 있으면 apiFetch 가
  // 요청을 아예 안 보내고 503 을 합성해 돌려주므로, 다음 시험이 이유 없이 실패한다.
  setServiceAvailability('available');
  __resetMigrationGuardsForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('이미 서버에 있는 것', () => {
  /* 이 시험이 결함 A 다. 예전 코드는 여기서 서버 찜을 지웠다. */
  it('절대 다시 올리지 않는다 — 올리면 지워지기 때문이다', async () => {
    toggleGuestWishlist(10);
    toggleGuestWishlist(20);
    const server = fakeServer([10]); // 10 은 다른 기기에서 이미 찜해 뒀다

    await migrateGuestWishlist(USER);

    expect(server.posts).toEqual([20]);
    expect([...server.rows].sort()).toEqual([10, 20]);
  });

  it('올리지 않은 것도 저장소에서는 뺀다 — 이미 옮겨진 것이니까', async () => {
    toggleGuestWishlist(10);
    fakeServer([10]);

    await migrateGuestWishlist(USER);

    expect(readGuestWishlist()).toEqual([]);
  });
});

describe('여러 번 돌아도 뒤집히지 않는다', () => {
  /* 결함 B. AuthGuard 는 경로가 바뀔 때마다 다시 도므로 재실행은 예외가 아니라 기본값이다. */
  it('연달아 두 번 돌려도 서버 상태가 그대로다', async () => {
    toggleGuestWishlist(1);
    toggleGuestWishlist(2);
    const server = fakeServer();

    await migrateGuestWishlist(USER);
    __resetMigrationGuardsForTest(); // 새 페이지 로드에서 다시 도는 상황
    await migrateGuestWishlist(USER);

    expect([...server.rows].sort()).toEqual([1, 2]);
    expect(server.posts).toEqual([1, 2]); // 두 번째 실행은 올릴 것이 없다
  });

  /*
   * 응답만 잃어버린 요청(502·타임아웃)이 제일 무섭다. 서버는 이미 담았는데 우리는 실패로 안다.
   * 다시 올리면 지워진다 — 다음 실행의 목록 조회가 그것을 막아야 한다.
   */
  it('서버는 담았는데 응답을 못 받은 것도 두 번 눌리지 않는다', async () => {
    toggleGuestWishlist(7);
    const server = fakeServer();
    server.behavior.postFails.add(7);

    await migrateGuestWishlist(USER);
    expect(readGuestWishlist()).toEqual([7]); // 실패했으니 남아 있다

    // 사실 서버에는 들어가 있었다고 하자(응답만 유실).
    server.rows.add(7);
    server.behavior.postFails.clear();
    __resetMigrationGuardsForTest();
    await migrateGuestWishlist(USER);

    expect([...server.rows]).toEqual([7]); // 지워지지 않았다
    expect(readGuestWishlist()).toEqual([]);
  });
});

describe('중간에 끊겨도 잃지 않는다', () => {
  /* 결함 D. 조회가 실패하면 서버 상태를 모르는 것이므로 아무것도 하지 않는다. */
  it('서버 목록을 못 읽으면 한 건도 올리지 않고 저장소도 그대로 둔다', async () => {
    toggleGuestWishlist(1);
    toggleGuestWishlist(2);
    const server = fakeServer();
    server.behavior.listFails = true;

    const outcome = await migrateGuestWishlist(USER);

    expect(outcome.skipped).toBe('list-failed');
    expect(server.posts).toEqual([]);
    expect(readGuestWishlist()).toEqual([1, 2]);
  });

  it('일부만 실패하면 성공한 것만 빠지고 나머지는 남는다', async () => {
    toggleGuestWishlist(1);
    toggleGuestWishlist(2);
    toggleGuestWishlist(3);
    const server = fakeServer();
    server.behavior.postFails.add(2);

    await migrateGuestWishlist(USER);

    expect(readGuestWishlist()).toEqual([2]);
    expect([...server.rows].sort()).toEqual([1, 3]);
  });

  /* 옮기는 동안 사용자는 계속 담는다. 그 창에서 담은 것을 덮어쓰면 안 된다. */
  it('옮기는 사이에 새로 담은 것을 지우지 않는다', async () => {
    toggleGuestWishlist(1);
    const server = fakeServer();
    // 요청이 나가 있는 사이에 사용자가 하나 더 담는다.
    server.behavior.onPost = () => toggleGuestWishlist(99);

    await migrateGuestWishlist(USER);

    expect(readGuestWishlist()).toEqual([99]);
    expect([...server.rows]).toEqual([1]);
  });
});

describe('경합', () => {
  /*
   * 조회와 올리기 사이에 다른 탭이 같은 팝업을 담으면 우리 POST 가 그것을 <b>지운다.</b> 서버가
   * 결과를 본문으로 알려주는 덕분에 우리 실수를 우리가 알아채고 되돌릴 수 있다.
   */
  it('REMOVED 가 오면 곧바로 되돌린다', async () => {
    toggleGuestWishlist(5);
    const server = fakeServer();
    server.behavior.raceBefore.add(5);

    await migrateGuestWishlist(USER);

    expect(server.posts).toEqual([5, 5]); // 지워 버린 것을 한 번 더 눌러 되돌렸다
    expect([...server.rows]).toEqual([5]);
    expect(readGuestWishlist()).toEqual([]);
  });

  it('되돌린 뒤에는 서버에 다시 물어 확정한다', async () => {
    toggleGuestWishlist(5);
    const server = fakeServer();
    server.behavior.raceBefore.add(5);

    await migrateGuestWishlist(USER);

    expect(server.listCalls).toHaveLength(2); // 시작 조회 + 확정 조회
  });
});

describe('요청을 한꺼번에 쏟지 않는다', () => {
  /* 결함 E. 순차 100번도, 동시 100번도 안 된다 — 앞은 느리고 뒤는 프록시를 통째로 때린다. */
  it('동시에 4개까지만 보낸다', async () => {
    for (let i = 1; i <= 30; i++) toggleGuestWishlist(i);
    const server = fakeServer();

    await migrateGuestWishlist(USER);

    expect(server.posts).toHaveLength(30);
    // 위(순차가 아님)와 아래(한꺼번에가 아님)를 <b>둘 다</b> 건다. 하나만 걸면 반대쪽으로
    // 되돌아가도 초록불이다 — 실제로 예전에는 상한만 걸어 두어 순차로 바꿔도 통과했다.
    expect(server.peak()).toBeGreaterThan(1);
    expect(server.peak()).toBeLessThanOrEqual(4);
    expect(server.rows.size).toBe(30);
  });
});

describe('돌려주는 숫자가 사실인가', () => {
  /*
   * 이 숫자는 장애를 볼 때 읽는 값이다. 틀리면 멀쩡한 이전을 실패로 읽고 엉뚱한 데를 판다.
   * 예전에는 failed 를 pending.length - confirmed.size 로 역산했는데, 확정 재조회가 실패하면
   * confirmed 가 비어서 <b>성공한 것까지 실패로 셌다.</b>
   */
  it('옮긴 것 · 이미 있던 것 · 실패한 것을 각각 센다', async () => {
    for (const id of [1, 2, 3]) toggleGuestWishlist(id);
    const server = fakeServer([2]); // 2 는 이미 서버에 있다
    server.behavior.postFails.add(3); // 3 은 428 로 실패한다

    const out = await migrateGuestWishlist(USER);

    expect(out).toMatchObject({ moved: 1, already: 1, failed: 1, unconfirmed: false });
    expect(readGuestWishlist()).toEqual([3]); // 실패한 것만 남는다
  });

  it('저장소에 같은 id 가 두 번 있어도 한 번만 보내고 한 번만 센다', async () => {
    window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify([5, 5, 5]));
    const server = fakeServer();

    const out = await migrateGuestWishlist(USER);

    // 토글이라 세 번 보내면 담겼다 지워졌다 담긴다. 애초에 한 번만 보낸다.
    expect(server.posts).toEqual([5]);
    expect(out).toMatchObject({ moved: 1, already: 0, failed: 0 });
    expect(server.rows.has(5)).toBe(true);
  });

  /*
   * 경합 뒤 확정 재조회가 실패하는 경우. 여기서 저장소를 비우면 <b>서버에 갔는지 모르는 채</b>
   * 브라우저 사본을 버리는 것이라, 이 설계에서 유일하게 데이터를 잃을 수 있는 지점이다.
   * 반대로 안 비우면 다음 실행이 "이미 있음" 으로 잡아 조용히 수렴한다 — 그래서 안 비운다.
   */
  it('경합 뒤 확정에 실패하면 저장소를 한 건도 비우지 않는다', async () => {
    for (const id of [1, 2]) toggleGuestWishlist(id);
    const server = fakeServer();
    server.behavior.raceBefore.add(1); // 1 은 조회 뒤 다른 탭이 먼저 넣었다
    server.behavior.onPost = () => {
      // 되돌리기까지 끝난 뒤의 확정 재조회를 실패시킨다.
      if (server.posts.length >= 3) server.behavior.listFails = true;
    };

    const out = await migrateGuestWishlist(USER);

    expect(readGuestWishlist().sort()).toEqual([1, 2]);
    expect(out.unconfirmed).toBe(true);
    // 확정을 못 지었을 뿐 올린 것은 올렸다. 이것을 실패로 세면 진단이 틀어진다.
    expect(out.failed).toBe(0);
  });
});

describe('실패해도 화면이 알 수 있는가', () => {
  /*
   * 이 작업 전체가 고치려던 것이 "로그인했더니 찜이 사라졌다" 화면이다. 이전이 실패하면 그
   * 화면이 그대로 남는데, 알림이 안 나가면 화면은 실패한 줄도 모르고 "찜한 팝업이 없습니다" 를
   * 띄운다. 그래서 <b>실패했을 때야말로</b> 알려야 한다.
   */
  it('목록 조회가 실패해도 완료 알림을 쏜다', async () => {
    toggleGuestWishlist(1);
    const server = fakeServer();
    server.behavior.listFails = true;
    const seen: MigrationOutcome[] = [];
    const onMigrated = (e: Event) => seen.push((e as CustomEvent<MigrationOutcome>).detail);
    window.addEventListener(GUEST_WISHLIST_MIGRATED_EVENT, onMigrated);

    await migrateGuestWishlist(USER);
    window.removeEventListener(GUEST_WISHLIST_MIGRATED_EVENT, onMigrated);

    expect(seen).toHaveLength(1);
    expect(seen[0].skipped).toBe('list-failed');
    expect(readGuestWishlist()).toEqual([1]);
  });

  it('사용자가 직접 다시 시도하면 쿨다운을 건너뛴다', async () => {
    toggleGuestWishlist(1);
    const server = fakeServer();
    server.behavior.listFails = true;
    await migrateGuestWishlist(USER);
    expect(server.listCalls).toHaveLength(1);

    // 자동 경로는 쿨다운에 막힌다 — 이것이 홈에 머무르면 아무 일도 안 일어나던 이유다.
    expect((await migrateGuestWishlist(USER)).skipped).toBe('busy');
    expect(server.listCalls).toHaveLength(1);

    // 사람이 누르면 통과한다.
    server.behavior.listFails = false;
    const out = await retryGuestWishlistMigration(USER);

    expect(out).toMatchObject({ moved: 1, failed: 0 });
    expect(readGuestWishlist()).toEqual([]);
  });
});

describe('언제 돌지 않는가', () => {
  /*
   * 토큰은 sessionStorage(탭 단위)인데 user 캐시와 게스트 목록은 localStorage(탭 공유)다.
   * 다른 탭에서 로그인하면 이 탭도 "로그인한 것처럼" 보이는데, 그 탭이 이전을 시작하면
   * 토큰 없이 POST 만 보내게 된다.
   */
  it('이 탭에 토큰이 없으면 시작하지 않는다', async () => {
    toggleGuestWishlist(1);
    window.sessionStorage.removeItem('token');
    const server = fakeServer();

    const outcome = await migrateGuestWishlist(USER);

    expect(outcome.skipped).toBe('no-token');
    expect(server.posts).toEqual([]);
    expect(readGuestWishlist()).toEqual([1]);
  });

  it('옮길 것이 없으면 서버를 부르지 않는다', async () => {
    const server = fakeServer();
    const outcome = await migrateGuestWishlist(USER);
    expect(outcome.skipped).toBe('empty');
    expect(server.listCalls).toEqual([]);
  });

  /* StrictMode 이중 호출·빠른 경로 이동이 여기 걸린다. 두 번 돌면 토글이 뒤집힌다. */
  it('같은 탭에서 동시에 두 번 부르면 한 번만 돈다', async () => {
    toggleGuestWishlist(1);
    const server = fakeServer();

    await Promise.all([migrateGuestWishlist(USER), migrateGuestWishlist(USER)]);

    expect(server.listCalls).toHaveLength(1);
    expect(server.posts).toEqual([1]);
  });

  /* 경로가 바뀔 때마다 다시 부르므로, 방금 실패한 것을 곧바로 다시 때리면 안 된다. */
  it('방금 실패했으면 잠시 쉰다', async () => {
    toggleGuestWishlist(1);
    const server = fakeServer();
    server.behavior.listFails = true;

    await migrateGuestWishlist(USER);
    const outcome = await migrateGuestWishlist(USER);

    expect(outcome.skipped).toBe('busy');
    expect(server.listCalls).toHaveLength(1);
  });
});

describe('옮긴 뒤 화면 알리기', () => {
  /*
   * 홈 MY 탭과 상세 하트는 자기 마운트 때 서버를 한 번 읽고 state 로 들고 있다. 이전은 그보다
   * 늦게 끝나므로 알려 주지 않으면 새로고침 전까지 "찜이 사라진" 화면이 그대로 남는다.
   */
  it('저장소에서 무언가 빠지면 알린다', async () => {
    toggleGuestWishlist(1);
    fakeServer();
    const heard = vi.fn();
    window.addEventListener(GUEST_WISHLIST_MIGRATED_EVENT, heard);

    await migrateGuestWishlist(USER);

    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(GUEST_WISHLIST_MIGRATED_EVENT, heard);
  });

  /*
   * 예전에는 여기서 "알리지 않는다" 를 단언했다 — 저장소에서 실제로 뺀 것이 있을 때만 쏘았기
   * 때문이다. 그런데 <b>못 옮겼을 때야말로 화면이 알아야 한다.</b> 안 알리면 MY 탭은 서버
   * 목록(비어 있음)만 보고 "아직 찜한 팝업스토어가 없습니다" 를 띄우는데, 저장소에는 멀쩡히
   * 남아 있다. 그 화면이 이 작업 전체가 고치려던 것이다. 시험이 그 결함을 지키고 있었다.
   */
  it('한 건도 못 옮겼을 때도 알린다 — 화면이 "없습니다" 라고 거짓말하지 않도록', async () => {
    toggleGuestWishlist(1);
    const server = fakeServer();
    server.behavior.postFails.add(1);
    const seen: MigrationOutcome[] = [];
    const onMigrated = (e: Event) => seen.push((e as CustomEvent<MigrationOutcome>).detail);
    window.addEventListener(GUEST_WISHLIST_MIGRATED_EVENT, onMigrated);

    await migrateGuestWishlist(USER);
    window.removeEventListener(GUEST_WISHLIST_MIGRATED_EVENT, onMigrated);

    expect(seen).toHaveLength(1);
    // 화면은 이 값을 보고 "옮기는 중" · "N건 못 옮김" · "정말 없음" 을 가른다.
    expect(seen[0]).toMatchObject({ moved: 0, failed: 1 });
    expect(readGuestWishlist()).toEqual([1]);
  });
});
