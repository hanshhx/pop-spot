import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Linking: { openURL: vi.fn() } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const { AUTH_DEEP_LINK_PREFIX, newNonce, parseAuthDeepLink, socialErrorMessage, socialLoginUrl } =
  await import('./socialAuth');

const link = (query: string) => `${AUTH_DEEP_LINK_PREFIX}?${query}`;

/**
 * 딥링크 해석.
 *
 * <p>이 한 줄이 틀리면 소셜 로그인이 통째로 안 되는데, 폰에서만 드러난다 — 브라우저가 앱을 깨우는
 * 순간을 재현할 수 없기 때문이다. 그래서 들어올 수 있는 문자열을 여기서 못박는다.
 */
describe('parseAuthDeepLink', () => {
  it('코드를 꺼낸다', () => {
    expect(parseAuthDeepLink(link('code=abc-123'))).toMatchObject({
      kind: 'code',
      code: 'abc-123',
    });
  });

  it('퍼센트 인코딩된 코드를 되돌린다', () => {
    expect(parseAuthDeepLink(link('code=a%2Bb%3Dc'))).toMatchObject({
      kind: 'code',
      code: 'a+b=c',
    });
  });

  it('UUID 를 그대로 읽는다 — 실제로 오는 값이다', () => {
    const uuid = '3f2b8c1e-9d4a-4f77-9a1b-2c0e5d8f7a66';
    expect(parseAuthDeepLink(link(`code=${uuid}`))).toMatchObject({ kind: 'code', code: uuid });
  });

  it('난수를 함께 읽는다 — 내가 시작한 로그인인지 가리는 근거다', () => {
    expect(parseAuthDeepLink(link('code=abc&n=xyz789ab'))).toEqual({
      kind: 'code',
      code: 'abc',
      nonce: 'xyz789ab',
    });
  });

  it('난수가 없으면 null — 옛 웹이 배포된 동안에도 흐름은 돌아야 한다', () => {
    expect(parseAuthDeepLink(link('code=abc'))?.nonce).toBeNull();
  });

  it('실패 사유를 꺼낸다', () => {
    expect(parseAuthDeepLink(link('error=no_email&n=abc12345'))).toEqual({
      kind: 'error',
      reason: 'no_email',
      nonce: 'abc12345',
    });
  });

  it('쿼리가 아예 없으면 실패로 본다 — 코드 없이 돌아온 것이다', () => {
    expect(parseAuthDeepLink(AUTH_DEEP_LINK_PREFIX)).toEqual({
      kind: 'error',
      reason: 'no_code',
      nonce: null,
    });
  });

  it('빈 code 는 코드가 아니다', () => {
    expect(parseAuthDeepLink(link('code='))).toMatchObject({ kind: 'error', reason: 'no_code' });
  });

  it('우리 주소가 아니면 null — 다른 딥링크를 가로채지 않는다', () => {
    expect(parseAuthDeepLink('popspot://popup/123')).toBeNull();
    expect(parseAuthDeepLink('https://popspot.co.kr/oauth/callback?code=x')).toBeNull();
    expect(parseAuthDeepLink('')).toBeNull();
  });

  it('파라미터가 여럿이어도 code 를 찾는다', () => {
    expect(parseAuthDeepLink(link('state=x&code=abc&foo=bar'))).toMatchObject({
      kind: 'code',
      code: 'abc',
    });
  });
});

describe('socialLoginUrl', () => {
  it('웹을 거친다 — 백엔드 주소를 앱에 박지 않으려고', () => {
    // 여기가 백엔드 호스트로 바뀌면 VM 교체 때 설치된 앱이 전부 죽는다(env.ts 주석).
    // 그리고 API_BASE_URL 이 아니라 WEB_BASE_URL 이어야 한다 — 이 라우트는 웹에만 있다.
    expect(socialLoginUrl('kakao', 'n1')).toBe('https://popspot.co.kr/oauth/start/kakao?n=n1');
    expect(socialLoginUrl('naver', 'n1')).toBe('https://popspot.co.kr/oauth/start/naver?n=n1');
    expect(socialLoginUrl('google', 'n1')).toBe('https://popspot.co.kr/oauth/start/google?n=n1');
  });

  it('난수를 인코딩해 싣는다 — 주소를 깨뜨리지 않게', () => {
    expect(socialLoginUrl('kakao', 'a b&c')).toContain('n=a%20b%26c');
  });
});

describe('newNonce', () => {
  it('웹 라우트가 받아 주는 모양이다', () => {
    // 웹 route.ts 의 NONCE_SHAPE 와 같은 정규식. 둘이 어긋나면 난수가 '1' 로 떨어져
    // 짝 맞추기가 조용히 무력해진다 — 로그인은 되므로 아무도 눈치채지 못한다.
    const shape = /^[A-Za-z0-9_-]{8,64}$/;
    for (let i = 0; i < 200; i += 1) expect(newNonce()).toMatch(shape);
  });

  it('부를 때마다 다르다', () => {
    const seen = new Set(Array.from({ length: 200 }, () => newNonce()));
    expect(seen.size).toBe(200);
  });
});

describe('socialErrorMessage', () => {
  it('이메일 미동의는 무엇을 해야 하는지 말한다', () => {
    expect(socialErrorMessage('no_email')).toContain('이메일');
  });

  it('취소도 문장이 있다', () => {
    expect(socialErrorMessage('denied')).toBeTruthy();
  });

  it('모르는 사유도 삼키지 않는다', () => {
    expect(socialErrorMessage('weird_thing')).toContain('weird_thing');
  });
});
