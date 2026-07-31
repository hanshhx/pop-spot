import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 엣지 서명이 **백엔드와 같은 값**을 만드는지 확인한다.
 *
 * 아래 세 상수는 백엔드 `EdgeSignatureVerifierTest` 에 박혀 있는 것과 **같은 값**이다. 즉 이 파일과
 * 그 파일이 서로 다른 언어로 같은 기준을 대조한다. 한쪽 구현만 바뀌면 둘 중 하나가 깨진다.
 *
 * 왜 이렇게까지 하냐면, 서명이 어긋나도 **화면에는 아무 증상이 없기 때문**이다. 요청은 전부 정상
 * 처리되고, 다만 백엔드가 모든 요청을 `remoteAddr` 로 강등한다. 증상은 한참 뒤에 "왜인지 회원가입
 * 인증메일이 시간당 5통에서 막힘" 같은 형태로만 나타난다. 실제로 한 번 겪었다 — 키 양쪽에 넣고
 * 켰더니 `서명 불일치` 경고만 계속 찍혔다.
 */
const SECRET = 'test-secret-123';
const PINNED_IP = '203.0.113.77';
const PINNED_TIMESTAMP = '1785460374973';
const PINNED_SIGNATURE = '4692ed3706bda7f5296f8cfc444b4d5488ab822c5010003fffc90fdbac3d2c47';

/** 비밀키는 모듈을 읽는 시점에 한 번만 잡히므로, 값을 바꾸려면 모듈을 다시 불러와야 한다. */
async function loadWithSecret(secret: string) {
  vi.stubEnv('EDGE_SIGNING_SECRET', secret);
  vi.resetModules();
  return import('./proxy');
}

describe('엣지 서명', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('백엔드 테스트에 박힌 값과 같은 서명을 만든다', async () => {
    const { edgeSignature } = await loadWithSecret(SECRET);

    await expect(edgeSignature(PINNED_IP, PINNED_TIMESTAMP)).resolves.toBe(PINNED_SIGNATURE);
  });

  it('키 앞뒤에 공백이 붙어도 같은 서명 — 백엔드도 공백을 뗀다', async () => {
    // Vercel 환경변수에 값을 붙여넣을 때 줄바꿈이 딸려 들어가는 일이 흔하다. 한쪽만 떼면
    // 모든 검증이 실패한다.
    const { edgeSignature } = await loadWithSecret(`  ${SECRET}\n`);

    await expect(edgeSignature(PINNED_IP, PINNED_TIMESTAMP)).resolves.toBe(PINNED_SIGNATURE);
  });

  it('IP 나 시각이 다르면 서명도 달라진다 — 값이 실제로 서명에 들어간다', async () => {
    const { edgeSignature } = await loadWithSecret(SECRET);

    await expect(edgeSignature('1.2.3.4', PINNED_TIMESTAMP)).resolves.not.toBe(PINNED_SIGNATURE);
    await expect(edgeSignature(PINNED_IP, '1785460374974')).resolves.not.toBe(PINNED_SIGNATURE);
  });
});
