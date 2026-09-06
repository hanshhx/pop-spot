import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const authGuard = read('src/components/AuthGuard.tsx');
const detail = read('app/popup/[id]/PopupDetailClient.tsx');
const header = read('src/components/layout/Header.tsx');
const home = read('app/HomeClient.tsx');
const loginPage = read('app/login/page.tsx');
const oauthCallback = read('app/oauth/callback/page.tsx');

/**
 * <b>로그인을 마친 사람은 원래 있던 자리로 돌아와야 한다. 어느 경로로 로그인했든.</b>
 *
 * <p><b>왜 파일을 읽어서 검사하나.</b> 지키려는 것이 한 함수의 동작이 아니라 <b>다섯 자리에
 * 빠짐없이 있는가</b>이기 때문이다. 착지 지점 하나를 빠뜨리면 그 경로로 로그인한 사람만 조용히
 * 홈으로 간다 — 화면에 오류가 없고, 다른 경로로 시험하면 멀쩡히 통과한다. 아무도 신고하지 않는
 * 부류의 고장이라 사람 눈에 기대면 안 된다.
 *
 * <p>같은 이유로 쓰인 선례가 옆에 있다: {@code GuestWishlistMigrationPlacement.test.ts},
 * {@code src/components/LocaleSwitcherPlacement.test.ts}.
 */

describe('로그인 뒤 착지 — 다섯 자리', () => {
  /*
   * 이메일 로그인 · 게스트 시작 · 이메일 2단계 인증. 셋 다 같은 헬퍼를 부른다.
   */
  it('로그인 화면의 착지 셋은 goAfterLogin 을 부른다', () => {
    expect(loginPage.match(/goAfterLogin\(\)/g) ?? []).toHaveLength(3);
  });

  it('goAfterLogin 은 복귀 주소를 꺼내 쓰고, 없으면 홈이다', () => {
    expect(loginPage).toContain("takeReturnTo(locale) ?? localizedPath('/', locale)");
  });

  /*
   * 소셜 콜백 · 소셜 2단계 인증. 이쪽은 window.location.href 로 통째로 이동한다.
   */
  it('소셜 콜백의 착지 둘은 landing() 을 부른다', () => {
    expect(oauthCallback.match(/window\.location\.href = landing\(\)/g) ?? []).toHaveLength(2);
  });

  /*
   * takeReturnTo 는 읽으면서 지운다. 콜백에서 두 번 부르면 먼저 부른 쪽이 지워 버려
   * 나머지 갈래가 홈으로 간다.
   */
  it('소셜 콜백은 복귀 주소를 한 번만 꺼낸다', () => {
    expect(oauthCallback.match(/takeReturnTo\(/g) ?? []).toHaveLength(1);
  });

  /*
   * 이 값이 남아 있으면 착지가 예전으로 돌아갔다는 뜻이다. 읽는 코드가 0인데 여섯 곳에서
   * 붙이고 있었고, 그것을 보던 미들웨어는 저장소에 없다.
   */
  it('아무도 읽지 않던 ?entered=1 로 이동하는 코드는 없다', () => {
    /* 주석은 걸리지 않게 <b>실제 이동 구문</b>만 본다 — 왜 지웠는지 설명하려면 그 값을
       적어야 하는데, 설명을 적었다고 시험이 깨지면 다음 사람은 설명을 지운다. */
    const navigatesToEntered =
      /(?:router\.push|window\.location\.href =|href=\{)\s*localizedPath\('\/\?entered=1'/;
    for (const [name, src] of [
      ['login', loginPage],
      ['oauth/callback', oauthCallback],
      ['HomeClient', home],
      ['Header', header],
    ] as const) {
      expect(navigatesToEntered.test(src), name).toBe(false);
    }
  });

  it('쓰기만 하던 popspot:oauth-locale 도 없앴다', () => {
    expect(loginPage).not.toContain('popspot:oauth-locale');
  });
});

describe('복귀 주소를 담는 자리', () => {
  it('팝업 상세 — 스탬프와 AI 코스 둘 다 이 팝업으로 돌아온다', () => {
    expect(detail.match(/rememberReturnTo\(`\/popup\/\$\{popup\.id\}`\)/g) ?? []).toHaveLength(2);
  });

  /*
   * lastTab 은 성공한 탭 전환에서만 기록된다. 막혀서 로그인까지 간 탭은 기록된 적이 없어
   * 이 자리가 없으면 지도로 돌아온다.
   */
  it('홈 — 잠긴 탭에서 밀려나면 그 탭을 적는다', () => {
    expect(home).toContain('rememberReturnTo(`/?tab=${tab}`)');
  });

  it('홈 — 안내창을 닫은 사람의 탭은 적지 않는다', () => {
    /* rememberLockedTab 은 confirmAction 이 참을 준 뒤에만 불린다. 호출은 네 곳 — 가입 유도,
       로그인 유도, 코스 저장, MY 탭 로그인 버튼. (정의는 화살표 함수라 이 정규식에 걸리지
       않는다.) 안내창 바깥으로 새어 나가면 이 수가 늘어난다. */
    expect(home.match(/rememberLockedTab\(/g) ?? []).toHaveLength(4);
  });

  it('헤더 로그인 — 지금 보던 화면을 적는다(쿼리 포함)', () => {
    expect(header).toContain('rememberReturnTo(window.location.pathname + window.location.search)');
  });

  it('AuthGuard — 보호 경로에서 밀려난 자리를 적는다', () => {
    expect(authGuard).toContain('rememberReturnTo(window.location.pathname');
  });

  /*
   * 약관을 거절하고 나가는 사람은 그 화면을 그만두겠다고 한 것이다. 남겨 두면 다음 로그인이
   * 방금 거절한 자리로 끌려간다.
   */
  it('AuthGuard — 약관을 거절하면 적어 둔 자리를 버린다', () => {
    expect(authGuard).toContain('forgetReturnTo()');
  });
});
