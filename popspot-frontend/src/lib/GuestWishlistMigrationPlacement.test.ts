import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const rootLayout = read('app/layout.tsx');
const authGuard = read('src/components/AuthGuard.tsx');
const detail = read('app/popup/[id]/PopupDetailClient.tsx');
const home = read('app/HomeClient.tsx');
const loginPage = read('app/login/page.tsx');
const oauthCallback = read('app/oauth/callback/page.tsx');

/**
 * <b>비회원 찜 이전은 로그인하면 반드시 돌아야 한다. 어느 화면에 떨어지든.</b>
 *
 * <p><b>왜 지키나.</b> 이전기가 팝업 상세 화면 안의 useEffect 하나였다. 그런데 로그인 성공은
 * 예외 없이 {@code /?entered=1}(홈)으로 착지한다 — 이메일·2단계 인증·소셜 콜백 전부. 그래서
 * <b>평범하게 로그인하면 이전이 한 번도 돌지 않았다.</b> 담아 둔 것은 브라우저에 남아 있는데
 * 홈 MY 탭은 로그인하는 순간 게스트 목록 렌더를 멈추므로, 사용자에게는 "가입했더니 찜이
 * 사라졌다" 로 보인다. 아무도 신고하지 않는 부류의 고장이다 — 화면에 오류가 없다.
 *
 * <p><b>왜 이렇게 검사하나.</b> 지키려는 것은 파일이 아니라 <b>도달 가능성</b>이다. 그래서
 * "이전기를 든 컴포넌트가 모든 화면을 감싸는가" 를 본다(같은 이유로 쓰인 선례:
 * {@code src/components/LocaleSwitcherPlacement.test.ts}).
 */
describe('게스트 찜 이전이 도는 자리', () => {
  it('이전기는 인증이 확정되는 자리에 있다', () => {
    expect(authGuard).toContain('migrateGuestWishlist(');
  });

  /*
   * app/layout.tsx 는 <html> 을 가진 유일한 루트 레이아웃이다. app/en/layout.tsx · app/ja/layout.tsx
   * 는 LocaleProvider 를 한 겹 더 씌우는 중첩 레이아웃이라 이것을 대체하지 않는다 — 즉 이 한 줄이
   * ko/en/ja · 홈/상세/랜딩 전부를 덮는다.
   */
  it('그 자리는 루트 레이아웃 안이다 — 모든 경로에서 마운트된다', () => {
    expect(rootLayout).toContain('<AuthGuard>');
  });

  /*
   * 이 두 줄이 결함의 본체였다. 로그인 착지가 홈인 한, 상세 화면에만 있는 이전기는 죽은 코드다.
   * 착지 주소가 바뀌면 이 시험도 함께 고쳐야 한다 — 그때 다시 생각해 보라는 뜻이다.
   */
  it('로그인 성공은 여전히 홈으로 착지한다', () => {
    expect(loginPage).toContain("localizedPath('/?entered=1', locale)");
    expect(oauthCallback).toContain("localizedPath('/?entered=1', locale)");
  });

  it('상세 화면은 더 이상 이전을 직접 하지 않는다', () => {
    expect(detail).not.toContain('takeGuestWishlist');
    expect(detail).not.toContain('restoreGuestWishlist');
  });

  /*
   * 이전이 끝나는 시점은 찜을 그리는 화면들의 마운트보다 늦다(/api/v1/auth/me 왕복을 기다린다).
   * 알림을 받지 않으면 새로고침 전까지 옛 목록이 그대로 남아, 이전이 성공해도 실패한 것처럼 보인다.
   */
  it.each([
    ['홈 MY 탭', () => home],
    ['팝업 상세 하트', () => detail],
  ])('%s 는 이전 완료를 듣는다', (_이름, source) => {
    expect(source()).toContain('GUEST_WISHLIST_MIGRATED_EVENT');
  });
});
