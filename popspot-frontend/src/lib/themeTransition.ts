/**
 * 테마를 바꾸는 <b>동안에만</b> 화면 전체를 부드럽게 흐르게 하는 장치.
 *
 * <p>색을 바꾸는 것은 next-themes 가 {@code <html>} 의 클래스를 갈아 끼우는 한 순간에 끝난다.
 * 그 순간 카드 면·테두리·아이콘·그림자가 <b>전부 동시에 튄다.</b> body 에 걸려 있던 전환은
 * 바탕 한 겹만 부드럽게 만들어서, 정작 눈에 띄는 것들은 그대로 딱딱했다.
 *
 * <p>해결은 전환하는 순간에만 전역 transition 을 켜는 것이다. 상시로 켜면 hover 처럼 즉각
 * 반응해야 하는 것들까지 늦게 따라와 조작이 둔해진다. 규칙은 globals.css 의
 * {@code .theme-switching} 에 있고, 여기서는 그 클래스를 붙였다 떼는 일만 한다.
 */

/** globals.css 의 전역 전환 규칙을 켜는 클래스. */
export const THEME_SWITCHING_CLASS = 'theme-switching';

/** CSS 에서 시간을 읽지 못했을 때 쓸 값. globals.css 의 --theme-switch-ms 와 맞춰 둔다. */
export const THEME_SWITCH_FALLBACK_MS = 320;

/**
 * {@code "320ms"} · {@code "0.32s"} 같은 CSS 시간 값을 밀리초 숫자로.
 *
 * <p>클래스를 떼는 시점이 전환보다 <b>빠르면</b> 색이 흐르다 말고 끊기고, 너무 늦으면 그동안
 * hover 가 둔해진다. 그래서 CSS 에 적힌 값을 그대로 읽어 쓴다.
 *
 * @param value getComputedStyle 로 읽은 값. 변수가 없으면 빈 문자열이 온다.
 * @param fallback 읽지 못했을 때 쓸 밀리초
 */
export function parseCssDuration(value: string, fallback = THEME_SWITCH_FALLBACK_MS): number {
  const text = value.trim();
  // 단위 순서에 주의 — 'ms' 를 먼저 본다. 's' 로 먼저 자르면 "320ms" 가 320초가 된다.
  const match = /^([0-9]*\.?[0-9]+)\s*(ms|s)$/.exec(text);
  if (!match) return fallback;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;

  return match[2] === 's' ? amount * 1000 : amount;
}

/** 지금 문서에 적힌 전환 길이(ms). */
export function themeSwitchMs(root: HTMLElement): number {
  return parseCssDuration(getComputedStyle(root).getPropertyValue('--theme-switch-ms'));
}
