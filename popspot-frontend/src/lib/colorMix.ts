/**
 * 색 두 개를 섞는다 — 지도 팔레트를 계절색 하나에서 뽑아내기 위한 최소한의 계산.
 *
 * <p>CSS 에는 {@code color-mix()} 가 있지만 여기서는 못 쓴다. MapLibre 는 스타일 스펙의 색을
 * 자기 파서로 읽는데 그 파서는 {@code color-mix()} 를 모른다 — 넘기면 레이어가 통째로 안 그려진다.
 * 그래서 JS 에서 미리 계산해 완성된 hex 를 넘긴다.
 *
 * <p>보간은 sRGB 에서 한다. 지각적으로는 OKLab 이 낫지만, 여기서 섞는 것은 거의 무채색에 가까운
 * 바탕끼리라 차이가 눈에 띄지 않는다. 색 공간 변환 코드를 지도 하나 때문에 들이지 않는다.
 */

/** {@code #0f171b} · {@code #abc} → [r, g, b]. 읽을 수 없으면 null. */
export function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, '');

  // 3자리 축약형(#abc)은 각 자리를 두 번 쓴 것과 같다.
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** [r, g, b] → {@code #rrggbb}. 범위를 벗어난 값은 잘라낸다. */
export function toHex(rgb: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${rgb.map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * {@code a} 에서 {@code b} 쪽으로 {@code t} 만큼 간 색.
 *
 * <p>둘 중 하나라도 읽을 수 없으면 <b>{@code a} 를 그대로 돌려준다.</b> 지도 색은 CSS 변수에서
 * 오는데, 변수가 비었거나 hex 가 아닌 형태(rgb() 등)로 들어올 수 있다. 그때 예외를 던지면 지도가
 * 통째로 안 뜬다 — 색 하나가 덜 예쁜 편이 낫다.
 *
 * @param t 0 이면 a, 1 이면 b. 범위를 벗어나면 잘라낸다.
 */
export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;

  const k = Math.max(0, Math.min(1, t));
  return toHex([
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  ]);
}
