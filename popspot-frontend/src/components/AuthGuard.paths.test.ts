import { describe, expect, it } from 'vitest';

import { isPublicPath } from './AuthGuard';

/**
 * 공개 경로 판정 — 같은 사고가 두 번 났던 자리라 테스트로 고정한다.
 *
 * <p>이 판정이 틀리면 <b>검색로봇은 200 을 받아 색인하는데 실제 방문자는 로그인으로 튕긴다.</b>
 * 서버 렌더는 통과하고 가드는 브라우저에서만 돌기 때문에, 빌드·타입검사·curl 로는 드러나지 않는다.
 * v2.43 에서 {@code /map} 이, v2.49 에서 {@code /en}·{@code /ja} 가 같은 이유로 막혀 있었다.
 */
describe('isPublicPath', () => {
  it('로그인 없이 볼 수 있는 페이지는 통과시킨다', () => {
    for (const p of ['/', '/login', '/signup', '/about', '/terms', '/privacy', '/map']) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it('검색 랜딩과 팝업 상세는 slug 가 붙어도 통과시킨다', () => {
    expect(isPublicPath('/popups/seongsu')).toBe(true);
    expect(isPublicPath('/popup/1234')).toBe(true);
  });

  it('언어별 주소도 한국어판과 똑같이 취급한다', () => {
    for (const p of [
      '/en',
      '/ja',
      '/en/popups/seongsu',
      '/ja/popups/demon-slayer',
      '/en/map',
      '/ja/about',
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it('회원 전용 페이지는 언어 접두어를 붙여도 막는다', () => {
    // 접두어를 떼는 규칙이 "무엇이든 통과" 로 새면 안 된다.
    for (const p of ['/planning', '/en/planning', '/ja/planning', '/music/passport']) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it('언어 코드처럼 보이는 다른 경로는 건드리지 않는다', () => {
    // '/enterprise' 가 '/en' 으로 시작한다고 접두어를 떼면 엉뚱한 경로가 된다.
    expect(isPublicPath('/enterprise')).toBe(false);
    expect(isPublicPath('/japan')).toBe(false);
  });

  it('경로를 모를 때는 막지 않는다', () => {
    expect(isPublicPath(null)).toBe(true);
  });
});
