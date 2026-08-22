/**
 * 잠깐만 붙였다 떼는 클래스 — 무언가가 <b>바뀌는 순간에만</b> 전환 효과를 켜기 위한 장치.
 *
 * <p>테마와 언어는 둘 다 화면 전체를 한 프레임에 갈아 치운다. 부드럽게 만들려면 전환 규칙이
 * 필요한데, 그것을 상시로 켜 두면 대가가 크다. 테마 쪽은 {@code *} 에 transition 이 걸려 hover 가
 * 늦어지고, 언어 쪽은 body 에 애니메이션이 남아 아무 때나 다시 재생될 수 있다.
 *
 * <p>그래서 바뀌는 순간에만 클래스를 붙이고, 전환이 끝나면 뗀다. 규칙은 globals.css 에 있고
 * 여기서는 시점만 관리한다.
 */

/** 라이트/다크 전환 중. 규칙은 globals.css 의 .theme-switching. */
export const THEME_SWITCHING_CLASS = 'theme-switching';

/** 언어 전환 중. 규칙은 globals.css 의 .locale-switching. */
export const LOCALE_SWITCHING_CLASS = 'locale-switching';

/** CSS 에서 시간을 읽지 못했을 때 쓸 값. */
export const FALLBACK_MS = 320;

/**
 * {@code "320ms"} · {@code "0.32s"} 같은 CSS 시간 값을 밀리초 숫자로.
 *
 * <p>클래스를 떼는 시점이 전환보다 <b>빠르면</b> 색이 흐르다 말고 끊기고, 너무 늦으면 그동안
 * 효과가 남아 있어 조작이 둔해진다. 그래서 CSS 에 적힌 값을 그대로 읽어 쓴다.
 *
 * @param value getComputedStyle 로 읽은 값. 변수가 없으면 빈 문자열이 온다.
 */
export function parseCssDuration(value: string, fallback = FALLBACK_MS): number {
  const text = value.trim();
  // 단위 순서에 주의 — 'ms' 를 먼저 본다. 's' 로 먼저 자르면 "320ms" 가 320초가 된다.
  const match = /^([0-9]*\.?[0-9]+)\s*(ms|s)$/.exec(text);
  if (!match) return fallback;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;

  return match[2] === 's' ? amount * 1000 : amount;
}

/**
 * 클래스 이름별로 하나씩만 도는 타이머.
 *
 * <p>호출하는 쪽에 ref 를 두지 않는 이유: 전환이 끝나기 전에 다시 누르면 앞선 타이머가 뒤늦게
 * 발화해 <b>한창 흐르는 중에 클래스를 떼어 버린다.</b> 두 번째 전환만 딱딱해지는데, 재현이
 * 어려워 원인을 찾기 힘든 종류의 버그다. 여기서 한 번에 관리하면 호출부마다 같은 실수를 반복할
 * 자리가 없어진다.
 */
const timers = new Map<string, number>();

/**
 * 전환이 끝날 때까지만 클래스를 붙인다.
 *
 * @param root 클래스를 받을 요소. 보통 {@code document.documentElement}
 * @param className 붙일 클래스
 * @param durationVar 전환 길이가 적힌 CSS 변수 이름. 예) {@code --theme-switch-ms}
 */
export function runTransientClass(root: HTMLElement, className: string, durationVar: string): void {
  root.classList.add(className);

  const ms = parseCssDuration(getComputedStyle(root).getPropertyValue(durationVar));

  window.clearTimeout(timers.get(className));
  timers.set(
    className,
    window.setTimeout(() => {
      root.classList.remove(className);
      timers.delete(className);
      // 전환이 끝나고 한 프레임 뒤에 뗀다. 딱 맞춰 떼면 마지막 프레임이 잘려 미세하게 튄다.
    }, ms + 40),
  );
}
