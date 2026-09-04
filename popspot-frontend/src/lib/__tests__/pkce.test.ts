import { webcrypto } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearVerifier, pkceAvailable, startPkce, takeVerifier } from '../pkce';

/**
 * 소셜 로그인 교환 코드를 <b>이 탭에 묶는</b> 값(RFC 7636).
 *
 * <p>예전엔 서버가 {@code code} 만 보고 토큰을 내줬다. 앱이 만드는 nonce 는 정상 앱이 <b>위조된</b>
 * 콜백을 걸러내는 장치인데 그 검사를 정상 앱이 자기 기기에서 하므로, 콜백을 <b>가로챈</b> 쪽은 그
 * 검사를 건너뛰고 code 만 보내면 됐다. 그래서 서버가 코드 자체를 시작한 쪽에 묶는다.
 *
 * <p>여기서 지키는 것 셋 — <b>(1) challenge 는 verifier 의 SHA-256 이다</b>(서버가 그렇게 대조한다),
 * <b>(2) verifier 는 한 번 쓰면 사라진다</b>, <b>(3) 만들 수 없는 환경에서 로그인을 막지 않는다</b>.
 */

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('window', {
    crypto: webcrypto,
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 서버(OAuthAttemptStore)가 통과시키는 모양과 같아야 한다 — base64url 43자. */
const CHALLENGE_SHAPE = /^[A-Za-z0-9_-]{43}$/;

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Buffer.from(new Uint8Array(digest))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('startPkce', () => {
  it('서버가 받는 모양의 challenge 를 낸다', async () => {
    const challenge = await startPkce();

    expect(challenge).toMatch(CHALLENGE_SHAPE);
  });

  /**
   * 이 검사가 핵심이다. 서버는 저장한 challenge 와 우리가 낸 verifier 의 SHA-256 을 대조한다 —
   * 여기가 어긋나면 정상 사용자의 로그인이 전부 교환 단계에서 실패한다.
   */
  it('challenge 는 보관한 verifier 의 SHA-256 이다', async () => {
    const challenge = await startPkce();
    const verifier = takeVerifier();

    expect(verifier).not.toBeNull();
    expect(await sha256Base64Url(verifier as string)).toBe(challenge);
  });

  it('매번 다른 값을 만든다', async () => {
    const a = await startPkce();
    takeVerifier();
    const b = await startPkce();

    expect(a).not.toBe(b);
  });

  /**
   * 저장이 먼저 성공해야 challenge 를 넘긴다. 순서가 반대면 서버는 묶었는데 우리는 열쇠가 없는
   * 상태가 되어, 그 사람의 로그인이 반드시 실패한다.
   */
  it('저장이 막히면 challenge 를 내지 않는다', async () => {
    vi.stubGlobal('window', {
      crypto: webcrypto,
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('storage blocked');
        },
        removeItem: () => {},
      },
    });

    expect(await startPkce()).toBeNull();
  });

  /**
   * {@code crypto.subtle} 은 보안 컨텍스트에서만 있다. 없는 환경에서 로그인을 막지는 않는다 —
   * 챌린지 없이 시작하면 서버가 구방식으로 기록하고 전환 기간에는 그대로 로그인된다.
   */
  it('crypto.subtle 이 없으면 null 이고 예외를 던지지 않는다', async () => {
    vi.stubGlobal('window', { crypto: {}, sessionStorage: { setItem: () => {} } });

    expect(pkceAvailable()).toBe(false);
    await expect(startPkce()).resolves.toBeNull();
  });
});

describe('takeVerifier', () => {
  /** 교환은 1회용이다. 남겨 두면 뒤로가기로 돌아왔을 때 이미 소비된 코드에 계속 붙는다. */
  it('한 번 꺼내면 사라진다', async () => {
    await startPkce();

    expect(takeVerifier()).not.toBeNull();
    expect(takeVerifier()).toBeNull();
  });

  it('없으면 null 이다', () => {
    expect(takeVerifier()).toBeNull();
  });
});

describe('clearVerifier', () => {
  it('시작하다 만 흐름의 찌꺼기를 치운다', async () => {
    await startPkce();

    clearVerifier();

    expect(takeVerifier()).toBeNull();
  });
});
