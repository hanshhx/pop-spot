import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, redirectTargetFor, sanitizeVersion } from '../../../app/basemap/route';

/**
 * 베이스맵 타일 경로는 <b>중계하지 않고 넘긴다</b>.
 *
 * <p>예전 구조가 문제였다. 이 핸들러가 원본을 {@code fetch} → {@code arrayBuffer} → 메모리 캐시로
 * 중계했는데, {@code OVERRIDE} 가 있으면 URL 결정에서 {@code v} 를 무시하면서도 <b>캐시 키에는
 * 검증 없이 넣었다</b>. 그래서 {@code ?v=아무값} 이면 매번 캐시 미스가 나고, 요청 하나가 곧 최대
 * 4MB 다운로드였다. 인증이 없는 공개 경로다.
 *
 * <p>지도는 웹·앱 모두 이미 {@code /seoul.pmtiles} 를 직접 부른다(커밋 350c2e2). 즉 이 경로에는
 * 정상 호출자가 없다. 그래도 지우지 않고 리다이렉트로 두는 이유는 설치된 구버전 앱이 아직 쓸
 * 가능성이 남아서다 — 리다이렉트면 그 클라이언트도 같은 파일을 받아 지도가 죽지 않는다.
 *
 * <p>그래서 이 검사들이 지키는 것은 두 가지다. <b>(1) 핸들러가 아무것도 내려받지 않는다</b>(상한을
 * 조인 게 아니라 경로가 사라졌다는 뜻). <b>(2) 목적지가 밖으로 샐 수 없다</b>.
 */

const req = (url: string, headers: Record<string, string> = { range: 'bytes=0-16383' }) =>
  new Request(url, { headers });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sanitizeVersion — 우리가 발급할 수 있는 모양만 통과', () => {
  /**
   * resolveBuildDate 가 만드는 값은 셋뿐이다: "static"(서명 실패 폴백), "s"+32비트 base36,
   * 8자리 날짜. 이 셋을 막으면 파일 교체 시 캐시 무효화 장치가 통째로 죽는다.
   */
  it('발급 가능한 세 모양을 통과시킨다', () => {
    expect(sanitizeVersion('static')).toBe('static');
    expect(sanitizeVersion('s1a2b3c')).toBe('s1a2b3c');
    expect(sanitizeVersion('20260904')).toBe('20260904');
  });

  /**
   * v 는 브라우저·CDN 의 캐시 키가 된다. 우리가 발급하지 않은 값을 그대로 넘기면 같은 파일 하나에
   * 캐시 항목이 무한히 생긴다 — 서버 메모리에서 나던 문제가 캐시 계층으로 자리만 옮기는 셈이다.
   */
  it('발급한 적 없는 값은 떨어뜨린다', () => {
    expect(sanitizeVersion('../../etc/passwd')).toBeNull();
    expect(sanitizeVersion('s' + 'z'.repeat(40))).toBeNull();
    expect(sanitizeVersion('202609041')).toBeNull();
    expect(sanitizeVersion('')).toBeNull();
    expect(sanitizeVersion(null)).toBeNull();
  });
});

describe('redirectTargetFor — 목적지', () => {
  /**
   * 상대 경로여야 한다. 절대 URL(OVERRIDE, 환경변수 유래)을 쓰면 환경변수 하나가 리다이렉트
   * 목적지를 바꾸는 구조가 된다 — 목적지는 코드가 정해야지 배포 설정이 정하면 안 된다.
   */
  it('언제나 같은 출처의 정적 파일을 가리킨다', () => {
    for (const v of ['static', 's1a2b3c', '20260904', 'https://evil.example/x', null]) {
      expect(redirectTargetFor(v)).toMatch(/^\/seoul\.pmtiles(\?|$)/);
    }
  });

  /**
   * 성한 v 는 보존한다. 떼면 구클라이언트가 파일 교체 후 옛 목차와 새 조각을 섞는다 —
   * ?v= 를 도입한 이유가 정확히 그 사고 방지였다(shared.ts 주석).
   */
  it('성한 v 는 보존한다', () => {
    expect(redirectTargetFor('s1a2b3c')).toBe('/seoul.pmtiles?v=s1a2b3c');
  });

  it('성치 않은 v 는 떼고 넘긴다', () => {
    expect(redirectTargetFor('아무값')).toBe('/seoul.pmtiles');
  });
});

describe('GET — 넘기기만 한다', () => {
  /**
   * 이 검사가 이 변경의 전부다. 원본 다운로드·버퍼링·메모리 캐시에서 오던 자원 고갈 경로가
   * <b>상한이 조여진 게 아니라 사라졌다</b>는 것을 fetch 호출 0건으로 못박는다.
   */
  it('원본을 한 번도 부르지 않는다', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');

    await GET(req('https://popspot.co.kr/basemap?v=s1a2b3c'));
    await GET(req('https://popspot.co.kr/basemap?v=아무거나'));
    await GET(req('https://popspot.co.kr/basemap'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('307 로 정적 파일에 넘긴다', async () => {
    const res = await GET(req('https://popspot.co.kr/basemap?v=s1a2b3c'));

    // 307 이어야 Range 가 보존된다("요청을 그대로 다시 보내라").
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/seoul.pmtiles?v=s1a2b3c');
  });

  /**
   * 나중에 이 경로를 지울 때 브라우저에 굳은 리다이렉트가 남으면 안 된다. 301/308 이나 장기
   * 캐시를 걸면 삭제해도 한동안 옛 클라이언트가 캐시된 리다이렉트를 따라간다.
   */
  it('리다이렉트를 캐시에 남기지 않는다', async () => {
    const res = await GET(req('https://popspot.co.kr/basemap?v=s1a2b3c'));

    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  /**
   * 중계가 없어져 우리 메모리가 터지지는 않지만, 이 경로가 56MB 통짜 내려받기의 두 번째 문이 될
   * 이유가 없다. 기존 계약도 그대로 지킨다.
   */
  it('Range 가 없거나 성치 않으면 거부한다', async () => {
    expect((await GET(req('https://popspot.co.kr/basemap', {}))).status).toBe(416);
    expect(
      (await GET(req('https://popspot.co.kr/basemap', { range: 'bytes=0-' }))).status,
    ).toBe(416);
    expect(
      (await GET(req('https://popspot.co.kr/basemap', { range: 'bytes=0-99999999' }))).status,
    ).toBe(416);
  });
});
