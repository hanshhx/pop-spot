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
 * <p><b>왜 지키나.</b> 이전기가 팝업 상세 화면 안의 useEffect 하나였다. 그런데 (그때는) 로그인
 * 성공이 예외 없이 홈으로 착지했다 — 이메일·2단계 인증·소셜 콜백 전부. 그래서
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
   * 여기 있던 시험은 "로그인 성공은 여전히 홈으로 착지한다" 였고, 주석은 <b>착지 주소가 바뀌면
   * 다시 생각해 보라</b>고 적어 두었다. 2026-09-06 에 바뀌었다 — 로그인은 이제 원래 있던 자리로
   * 돌아간다(lib/returnTo.ts).
   *
   * 다시 생각한 결과: <b>이전기는 영향을 받지 않는다.</b> 그때 이전기를 상세 화면에서 AuthGuard 로
   * 옮긴 이유가 "착지가 홈이라서" 가 아니라 "루트 레이아웃이라 어느 화면에서든 마운트되어서"
   * 였기 때문이다. 오히려 착지가 여러 곳으로 흩어진 지금 그 선택이 더 중요해졌다 — 착지 주소를
   * 하나씩 좇는 설계였다면 이번 변경에서 조용히 깨졌을 것이다.
   *
   * 그래서 이 시험은 착지 주소를 세지 않고, <b>착지 주소와 무관하다는 것</b>을 지킨다.
   */
  it('이전은 착지 주소에 기대지 않는다 — 어느 경로든 루트에서 돈다', () => {
    expect(authGuard).toContain('migrateGuestWishlist(');
    expect(loginPage).not.toContain('migrateGuestWishlist');
    expect(oauthCallback).not.toContain('migrateGuestWishlist');
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
