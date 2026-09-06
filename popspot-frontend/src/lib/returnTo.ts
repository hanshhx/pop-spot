/**
 * 로그인하고 나면 <b>원래 있던 자리로 돌아온다.</b>
 *
 * <p><b>왜 필요한가.</b> 로그인 성공은 예외 없이 홈으로 착지했다 — 이메일·2단계 인증·소셜 콜백
 * 전부 {@code localizedPath('/?entered=1', locale)} 한 줄이었다. 반대로 <b>로그인으로 보내는 곳은
 * 스무 곳이 넘는다.</b> 팝업 상세에서 스탬프를 찍으려던 사람도, 잠긴 COURSE 탭을 열려던 사람도,
 * 로그인을 마치면 지도 화면에 떨어져서 <b>자기가 무엇을 하려 했는지부터 다시 찾아야</b> 한다.
 *
 * <p>그 사람은 이미 우리가 원하던 일을 하려던 사람이다. 가입까지 마친 <b>직후에</b> 길을 잃게
 * 만드는 셈이라, 전환을 가장 비싸게 치르는 자리에서 그것을 흘린다.
 *
 * <p><b>왜 sessionStorage 인가.</b> 이 값은 <b>브라우저를 통째로 백엔드에 넘겼다가 돌아오는
 * 왕복</b>을 살아남아야 한다({@code window.location.href = .../oauth2/authorization/kakao} → 카카오
 * → {@code /oauth/callback}). 그래서 {@code /login} 에 붙인 쿼리(?next=)로는 안 된다 — 소셜은 그
 * 주소로 돌아오지 않는다. sessionStorage 가 이 왕복을 건넌다는 것은 추측이 아니라 <b>지금 운영에서
 * 입증된 사실</b>이다: PKCE verifier 가 정확히 같은 구간을 이 저장소로 건넌다({@code lib/pkce.ts}).
 *
 * <p><b>왜 쿠키가 아닌가.</b> 쿠키는 창 전체가 공유한다. 탭 A 에서 팝업을 보다 로그인하러 가고
 * 탭 B 에서 다른 로그인을 마치면 <b>탭 B 가 탭 A 의 목적지로 끌려간다.</b> 게다가 이 흐름에는 이미
 * 쿠키가 하나 있는데({@code popspot_oauth_app}), 그 파일 주석 절반이 "지우는 곳을 한 군데라도
 * 빠뜨리면 다음 로그인이 앱으로 튕긴다" 는 이야기다. 같은 함정을 하나 더 팔 이유가 없다.
 *
 * <p><b>없으면 홈이다.</b> 저장이 없거나·형식이 틀리거나·시간이 지났으면 예전과 한 글자도 다르지
 * 않게 홈으로 간다. 이 설계는 <b>회귀가 불가능하도록</b> 되어 있다.
 */

import type { Locale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

/** sessionStorage 키. */
export const RETURN_TO_KEY = 'popspot:return-to';

/**
 * 30분 — {@code homeReturnScroll} 의 복귀 상태와 같은 값이다.
 *
 * <p>탭을 열어 둔 채 다른 일을 하다 한참 뒤에 로그인한 사람을 옛 목적지로 보내면, 본인은 그
 * 화면을 요청한 기억이 없어서 <b>고장으로 읽힌다.</b>
 */
const RETURN_TO_TTL_MS = 30 * 60_000;

/**
 * 돌아갈 자리가 <b>될 수 없는</b> 경로.
 *
 * <p>로그인을 마치고 로그인 화면으로 돌아가면 고리가 된다. 콜백({@code /oauth/callback})은 1회용
 * 코드가 이미 소진된 주소라 다시 열면 실패 화면만 뜨고, {@code /app/auth} 는 앱으로 넘기는
 * 중계 주소다.
 *
 * <p>담는 쪽에서 이런 경로를 넣지 않도록 골라 두었지만 <b>여기서 한 번 더</b> 막는다. 담는 자리는
 * 다섯 곳이고 앞으로 늘어나는데, 판단이 그쪽에 흩어져 있으면 새로 추가하는 사람이 이 목록의
 * 존재를 모른다.
 */
const NEVER_RETURN_PREFIXES = ['/login', '/signup', '/oauth', '/app/auth', '/find-account'];

interface ReturnToState {
  path: string;
  savedAt: number;
}

/**
 * 이 경로를 로그인 뒤 돌아갈 자리로 기억한다. <b>로그인으로 보내기 직전에</b> 부른다.
 *
 * <p>로케일 접두사는 있어도 되고 없어도 된다 — 꺼낼 때 {@link takeReturnTo} 가 <b>그때의</b>
 * 언어로 다시 붙인다. 흐름 중간에 언어를 바꾼 사람이 옛 접두사로 착지하지 않게 하기 위함이다.
 * (이 자리를 노리다 만 흔적이 {@code localStorage['popspot:oauth-locale']} 이었다 — 쓰기만 하고
 * 읽는 곳이 없어 이번에 지웠다.)
 *
 * <p>저장에 실패해도 알리지 않는다. 시크릿 창처럼 저장소가 막힌 환경에서는 복귀가 안 될 뿐,
 * 로그인 자체는 그대로 되어야 한다 — 여기서 막으면 잃는 것이 훨씬 크다.
 */
export function rememberReturnTo(path: string): void {
  if (typeof window === 'undefined') return;
  const savedAt = Date.now();
  // 담는 자리에서 한 번 거른다 — 못 쓸 값을 저장해 두면 꺼낼 때 조용히 홈으로 가고,
  // 담는 쪽 실수가 "복귀가 원래 안 되는 자리" 처럼 보여 눈에 띄지 않는다.
  if (resolveReturnTo({ path, savedAt }, savedAt) === null) return;
  try {
    const state: ReturnToState = { path, savedAt };
    window.sessionStorage.setItem(RETURN_TO_KEY, JSON.stringify(state));
  } catch {
    /* 저장이 안 돼도 로그인은 진행한다. 복귀만 못 할 뿐이다. */
  }
}

/**
 * 기억해 둔 자리를 <b>꺼내면서 지운다.</b> 없거나 믿을 수 없으면 {@code null}.
 *
 * <p><b>왜 꺼내면서 지우는가.</b> 한 번 쓰고 나면 목적을 다한 값이다. 남겨 두면 그 다음 로그인이
 * — 몇 시간 뒤 전혀 다른 의도로 한 로그인이 — 옛 목적지로 끌려간다. TTL 이 있지만 그것은
 * 마지막 방어선이고, 정상 경로에서는 <b>쓴 즉시</b> 없어져야 한다.
 *
 * @param locale 지금 화면의 언어 — 돌려주는 주소에 이 언어의 접두사를 붙인다
 */
export function takeReturnTo(locale: Locale, now: number = Date.now()): string | null {
  if (typeof window === 'undefined') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(window.sessionStorage.getItem(RETURN_TO_KEY) ?? 'null');
    window.sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    return null;
  }
  const path = resolveReturnTo(raw, now);
  return path === null ? null : localizedPath(path, locale);
}

/** 기억해 둔 자리를 버린다. 돌아가면 안 되게 된 경우(탈퇴·약관 거절)에 부른다. */
export function forgetReturnTo(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    /* 못 지워도 TTL 이 30분 뒤에 끝낸다. */
  }
}

/**
 * 저장된 값을 <b>믿어도 되는지</b> 판단한다. 되면 경로를, 안 되면 {@code null}.
 *
 * <p><b>이 함수가 이 파일의 안전장치 전부다.</b> 순수 함수인 이유는 {@code homeReturnScroll} 과
 * 같다 — 조건의 교집합이라 하나만 놓쳐도 조용히 깨지는데, 컴포넌트 안에 있으면 브라우저 없이
 * 시험할 수 없다.
 *
 * <p>sessionStorage 값은 <b>무엇이든 들어올 수 있다고 본다.</b> 사용자가 개발자도구로 직접 고칠
 * 수 있고, 과거 버전이 다른 모양으로 남겼을 수도 있다.
 *
 * <p>통과하려면 <b>전부</b> 만족해야 한다:
 *
 * <ul>
 *   <li>{@code /} 로 시작한다 — 절대 주소는 우리 사이트가 아니다
 *   <li>{@code //} 로 시작하지 <b>않는다.</b> 이것이 제일 조용한 위험이다: {@code //evil.com} 은
 *       {@code /} 로 시작해 우리 경로처럼 보이지만 <b>프로토콜 상대 URL</b> 이라 브라우저가
 *       {@code https://evil.com} 으로 간다. 로그인 <b>직후</b> 리다이렉트에서 이게 열리면
 *       방금 로그인한 사람을 남의 사이트로 넘기는 열린 리다이렉트가 된다
 *   <li>{@code \} 와 {@code :} 를 담지 않는다 — {@code /\evil.com} 을 역슬래시로 읽는 브라우저가
 *       있고, {@code :} 는 {@code javascript:} 같은 스킴이 끼어들 자리다
 *   <li>{@link NEVER_RETURN_PREFIXES} 로 시작하지 않는다
 *   <li>30분 안이다
 * </ul>
 */
export function resolveReturnTo(raw: unknown, now: number): string | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { path, savedAt } = raw as Record<string, unknown>;
  if (typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.includes('\\') || path.includes(':')) return null;

  // 접두사 판정은 경로 구간 단위로 한다 — '/loginish' 까지 막아 버리면 안 되고, 반대로
  // '/login?x=1' 은 막아야 한다.
  const head = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if (NEVER_RETURN_PREFIXES.some((p) => head === p || head.startsWith(`${p}/`))) return null;

  const savedAtMs = typeof savedAt === 'number' ? savedAt : 0;
  if (now - savedAtMs > RETURN_TO_TTL_MS) return null;
  // 미래에 저장된 값(시계가 뒤로 갔거나 손댄 값)은 TTL 을 무한정 통과하므로 함께 막는다.
  if (savedAtMs > now) return null;

  return path;
}
