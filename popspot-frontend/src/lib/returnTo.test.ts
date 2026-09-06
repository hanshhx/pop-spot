// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  RETURN_TO_KEY,
  forgetReturnTo,
  rememberReturnTo,
  resolveReturnTo,
  takeReturnTo,
} from './returnTo';

/**
 * <p>이 시험이 지키는 것은 두 가지다.
 *
 * <ol>
 *   <li><b>남의 사이트로 넘기지 않는다.</b> 복귀는 로그인 <b>직후</b>에 일어나는 이동이라, 여기서
 *       외부 주소가 통과하면 방금 로그인한 사람을 그대로 넘겨 준다. 아래 "믿을 수 없는 값" 묶음이
 *       이 파일의 존재 이유다.
 *   <li><b>없으면 예전과 똑같이 홈이다.</b> 복귀가 안 되는 것보다 나쁜 것은 복귀 때문에 로그인이
 *       이상해지는 것이다.
 * </ol>
 */

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('믿을 수 없는 값은 통과시키지 않는다', () => {
  /*
   * '//evil.com' 이 이 목록에서 제일 중요하다. '/' 로 시작해서 우리 경로처럼 보이지만
   * 프로토콜 상대 URL 이라 브라우저는 https://evil.com 으로 간다. 눈으로 검토할 때 가장
   * 놓치기 쉬운 모양이다.
   */
  it.each([
    ['프로토콜 상대 주소', '//evil.com'],
    ['프로토콜 상대 주소 + 경로', '//evil.com/popup/1'],
    ['절대 주소', 'https://evil.com'],
    ['역슬래시 우회', '/\\evil.com'],
    ['역슬래시 두 번', '\\\\evil.com'],
    ['스킴', 'javascript:alert(1)'],
    ['경로처럼 보이는 스킴', '/x/javascript:alert(1)'],
    ['상대 경로', 'popup/1'],
    ['빈 문자열', ''],
  ])('%s 는 거절한다 — %s', (_name, path) => {
    expect(resolveReturnTo({ path, savedAt: NOW }, NOW)).toBeNull();
  });

  it.each([
    ['null', null],
    ['문자열', 'not-an-object'],
    ['숫자', 42],
    ['path 가 없는 객체', { savedAt: NOW }],
    ['path 가 숫자', { path: 7, savedAt: NOW }],
  ])('%s 은 거절한다', (_name, raw) => {
    expect(resolveReturnTo(raw, NOW)).toBeNull();
  });

  it('30분이 지나면 거절한다', () => {
    const savedAt = NOW - 31 * MINUTE;
    expect(resolveReturnTo({ path: '/popup/1', savedAt }, NOW)).toBeNull();
  });

  it('29분은 아직 통과한다', () => {
    const savedAt = NOW - 29 * MINUTE;
    expect(resolveReturnTo({ path: '/popup/1', savedAt }, NOW)).toBe('/popup/1');
  });

  /*
   * savedAt 을 미래로 적어 두면 (now - savedAt) 이 음수라 TTL 검사를 영원히 통과한다.
   * 손으로 고친 값이거나 시계가 뒤로 간 기기다. 둘 다 30분 규칙을 무력화한다.
   */
  it('미래에 저장된 값은 거절한다 — TTL 을 무한정 통과하므로', () => {
    expect(resolveReturnTo({ path: '/popup/1', savedAt: NOW + MINUTE }, NOW)).toBeNull();
  });

  it('savedAt 이 없으면 거절한다', () => {
    expect(resolveReturnTo({ path: '/popup/1' }, NOW)).toBeNull();
  });
});

describe('돌아가면 안 되는 자리', () => {
  /*
   * 로그인을 마치고 로그인 화면으로 돌아가면 고리가 된다. 콜백은 1회용 코드가 이미 소진된
   * 주소라 다시 열면 실패 화면만 뜬다.
   */
  it.each([
    '/login',
    '/login?error',
    '/signup',
    '/oauth/callback',
    '/oauth/callback?code=abc',
    '/app/auth',
    '/find-account',
    '/login/',
  ])('%s 로는 돌아가지 않는다', (path) => {
    expect(resolveReturnTo({ path, savedAt: NOW }, NOW)).toBeNull();
  });

  /*
   * 접두사를 문자열 startsWith 로만 보면 이런 경로까지 막힌다. 지금은 없는 주소지만,
   * 규칙이 "구간 단위" 라는 것을 박아 둔다 — 나중에 /logins 같은 경로가 생겨도 조용히
   * 복귀만 안 되는 일이 없도록.
   */
  it('이름이 비슷할 뿐인 경로는 막지 않는다', () => {
    expect(resolveReturnTo({ path: '/loginish', savedAt: NOW }, NOW)).toBe('/loginish');
  });
});

describe('통과하는 값', () => {
  it.each([
    ['팝업 상세', '/popup/6291'],
    ['홈 탭', '/?tab=COURSE'],
    ['홈', '/'],
    ['랜딩', '/popups/some-slug'],
    ['영어 접두사가 붙은 채로 저장돼도 받는다', '/en/popup/6291'],
  ])('%s — %s', (_name, path) => {
    expect(resolveReturnTo({ path, savedAt: NOW }, NOW)).toBe(path);
  });
});

describe('담고 꺼내기', () => {
  it('담은 자리로 돌아간다', () => {
    rememberReturnTo('/popup/6291');
    expect(takeReturnTo('ko')).toBe('/popup/6291');
  });

  /*
   * 한 번 쓰면 목적을 다한 값이다. 남겨 두면 몇 시간 뒤 전혀 다른 의도로 한 로그인이
   * 옛 목적지로 끌려간다. TTL 은 마지막 방어선일 뿐, 정상 경로에서는 즉시 없어져야 한다.
   */
  it('꺼내면 없어진다 — 다음 로그인이 끌려가지 않게', () => {
    rememberReturnTo('/popup/6291');
    expect(takeReturnTo('ko')).toBe('/popup/6291');
    expect(takeReturnTo('ko')).toBeNull();
    expect(window.sessionStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it('담은 적이 없으면 null — 부르는 쪽은 예전처럼 홈으로 간다', () => {
    expect(takeReturnTo('ko')).toBeNull();
  });

  /*
   * 로케일 접두사는 저장하지 않고 꺼낼 때 붙인다. 소셜 로그인 왕복 중에 언어를 바꾼 사람이
   * 옛 접두사로 착지하지 않게 하기 위함이다.
   */
  it('꺼낼 때의 언어로 접두사를 붙인다', () => {
    rememberReturnTo('/popup/6291');
    expect(takeReturnTo('en')).toBe('/en/popup/6291');
  });

  it('저장할 때 접두사가 붙어 있어도 꺼낼 때의 언어를 따른다', () => {
    rememberReturnTo('/en/popup/6291');
    expect(takeReturnTo('ja')).toBe('/ja/popup/6291');
  });

  /*
   * 담는 쪽 실수를 저장 단계에서 거른다. 안 거르면 "저장은 됐는데 꺼낼 때 null" 이 되어,
   * 복귀가 원래 안 되는 자리처럼 보인다 — 눈에 띄지 않는 종류의 고장이다.
   */
  it('못 쓸 주소는 담기지도 않는다', () => {
    rememberReturnTo('//evil.com');
    expect(window.sessionStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it('버리면 없어진다', () => {
    rememberReturnTo('/popup/6291');
    forgetReturnTo();
    expect(takeReturnTo('ko')).toBeNull();
  });

  it('저장소에 쓰레기가 들어 있어도 던지지 않는다', () => {
    window.sessionStorage.setItem(RETURN_TO_KEY, '{not json');
    expect(takeReturnTo('ko')).toBeNull();
  });
});
