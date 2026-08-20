/**
 * 배경 영상이 멈춘 채로 남았는지 판정한다.
 *
 * <p>{@code LoopingBgVideo} 는 {@code <video>} 두 개를 번갈아 재생하며 크로스페이드한다. 이 구조에는
 * 화면이 마지막 프레임에서 굳어 버리는 경로가 여럿 있는데, 어느 것도 오류를 내지 않아 조용히 멈춘다.
 *
 * <ul>
 *   <li>{@code play()} 거절 — 자동재생 정책·절전 모드·배경 탭에서 거절되면 그 편은 시작하지 않는다.
 *       그런데 크로스페이드는 그대로 진행되므로, <b>멈춘 영상이 화면에 드러난다.</b>
 *   <li>{@code timeupdate} 누락 — 교대는 남은 시간이 1.45초 이하일 때만 걸린다. 배경 탭에서는 이
 *       이벤트가 드물게 와서 그 구간을 건너뛸 수 있고, 그러면 영상이 끝난 채로 선다.
 *   <li>버퍼링 정지 — 네트워크가 끊기면 재생 상태 그대로 시간만 멈춘다.
 * </ul>
 *
 * <p>세 경우 모두 "재생 중이어야 하는데 시간이 흐르지 않는다" 로 나타난다. 그래서 원인을 구분하지
 * 않고 이 한 가지 신호로 판정하고, 호출부는 그저 다시 재생을 건다.
 */

/**
 * 시간이 흘렀다고 볼 최소 변화량(초).
 *
 * <p>재생 중이면 감시 간격(2초) 동안 최소 수백 밀리초는 움직인다. 0.01초는 부동소수 오차와
 * 프레임 경계만 걸러내는 값이라, 실제 재생을 멈춤으로 오판하지 않는다.
 */
export const STALL_EPSILON_SECONDS = 0.01;

/**
 * @param paused 영상이 일시정지 상태인가
 * @param ended 끝까지 재생되고 멈췄는가
 * @param currentTime 지금 재생 위치(초)
 * @param previousTime 직전 감시 때의 재생 위치(초). 첫 감시라 비교 대상이 없으면 음수를 넘긴다 —
 *     재생 위치는 0 이상이므로 음수와는 반드시 {@code STALL_EPSILON_SECONDS} 넘게 벌어지고,
 *     따라서 첫 감시는 저절로 "멈춤 아님" 이 된다. 별도 분기를 두지 않는 이유다.
 */
export function isPlaybackStalled(
  paused: boolean,
  ended: boolean,
  currentTime: number,
  previousTime: number,
): boolean {
  if (paused || ended) return true;
  return Math.abs(currentTime - previousTime) < STALL_EPSILON_SECONDS;
}
