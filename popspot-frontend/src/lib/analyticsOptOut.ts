/**
 * <b>내 방문을 방문 통계에서 뺀다.</b>
 *
 * <p>사이트를 만드는 사람은 하루에도 수십 번 자기 사이트를 연다. 그것이 방문자 수에 섞이면
 * 숫자가 부풀 뿐 아니라, <b>어떤 날이 진짜 좋았는지</b>를 알 수 없게 된다 — 배포한 날일수록
 * 자기 방문이 많아서, 개선의 효과와 자기 발자국이 같은 방향으로 움직인다.
 *
 * <p><b>봇은 여기서 다루지 않는다.</b> Vercel 이 보내는 수집 스크립트가 이미
 * {@code navigator.webdriver} 와 {@code Headless} 사용자 에이전트를 걸러낸다(2026-09-01 운영
 * 스크립트에서 직접 확인). 여기에 사용자 에이전트 목록을 더 붙이면 걸러지는 것보다 <b>진짜
 * 사용자를 잘못 빼는 위험</b>이 크다.
 */

/** 브라우저에 남기는 표시. 지우면 다시 집계된다. */
export const OPT_OUT_KEY = 'popspot:analytics:ignore';

/** 주소로 켜고 끄는 이름 — {@code ?ignore-analytics=1} / {@code =0}. */
export const OPT_OUT_PARAM = 'ignore-analytics';

/**
 * 주소에 담긴 지시 — 켜라({@code true}) · 꺼라({@code false}) · 아무 말 없음({@code null}).
 *
 * <p><b>왜 주소로도 켜는가.</b> 개발자 도구 콘솔에 한 줄 넣는 방법은 PC 에서만 쉽다. 휴대폰에서는
 * 사실상 불가능한데, 정작 자기 사이트를 가장 자주 여는 것이 휴대폰이다. 주소 뒤에 한 번 붙여
 * 열면 그 뒤로는 계속 빠진다.
 */
export function optOutFromSearch(search: string): boolean | null {
  const raw = new URLSearchParams(search).get(OPT_OUT_PARAM);
  if (raw === null) return null;
  /* 빈 값(?ignore-analytics)도 켜는 것으로 본다 — 주소를 손으로 칠 때 값을 빼먹기 쉽다. */
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 이 브라우저가 빠지기로 돼 있는가. 저장소를 못 읽으면 <b>집계한다</b>(빠지는 쪽이 기본이면 안 된다). */
export function isOptedOut(storage: ReadableStorage | null | undefined): boolean {
  try {
    return storage?.getItem(OPT_OUT_KEY) === '1';
  } catch {
    /* 사생활 보호 모드 등에서 접근 자체가 막힌다. */
    return false;
  }
}

/** 표시를 남기거나 지운다. */
export function setOptOut(storage: WritableStorage | null | undefined, on: boolean): void {
  try {
    if (on) storage?.setItem(OPT_OUT_KEY, '1');
    else storage?.removeItem(OPT_OUT_KEY);
  } catch {
    /* 못 써도 화면이 깨지면 안 된다. */
  }
}

/**
 * 주소의 지시를 반영한 뒤 지금 상태를 돌려준다.
 *
 * <p>지시가 없으면 저장된 값을 그대로 쓴다 — 한 번 켜 두면 주소를 다시 붙이지 않아도 계속 빠진다.
 */
export function resolveOptOut(
  storage: WritableStorage | null | undefined,
  search: string,
): boolean {
  const asked = optOutFromSearch(search);
  if (asked !== null) setOptOut(storage, asked);
  return isOptedOut(storage);
}
