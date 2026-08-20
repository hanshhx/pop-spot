import { describe, expect, it } from 'vitest';

import { isPlaybackStalled } from './videoWatchdog';

describe('isPlaybackStalled', () => {
  it('재생 위치가 흐르고 있으면 멈춘 것이 아니다', () => {
    expect(isPlaybackStalled(false, false, 4.2, 2.1)).toBe(false);
  });

  it('재생 중이라는데 위치가 그대로면 멈춘 것으로 본다', () => {
    // 버퍼링 정지. paused 도 ended 도 아닌데 시간만 서 있다.
    expect(isPlaybackStalled(false, false, 4.2, 4.2)).toBe(true);
  });

  it('일시정지는 위치와 무관하게 멈춘 것이다', () => {
    // play() 가 거절돼 시작조차 못 한 경우가 여기에 해당한다.
    expect(isPlaybackStalled(true, false, 0, -1)).toBe(true);
  });

  it('끝까지 재생되고 선 것도 멈춘 것이다', () => {
    // 교대가 걸리지 않아 마지막 프레임에 굳은 경우.
    // 직전 감시(5초) 이후 끝까지 흘러왔으므로 위치는 달라져 있다. 위치만 보면 정상 재생으로
    // 보이는 상황이라, ended 를 따로 보지 않으면 놓친다.
    expect(isPlaybackStalled(false, true, 12, 5)).toBe(true);
  });

  it('첫 감시(직전 값 없음)는 멈춤으로 보지 않는다', () => {
    // 음수 표식은 어떤 재생 위치와도 충분히 벌어지므로 저절로 "멈춤 아님" 이 된다.
    // 재생이 아직 0초에 서 있어도 마찬가지다 — 다음 감시에서 0 대 0 으로 비교돼 잡힌다.
    expect(isPlaybackStalled(false, false, 0.3, -1)).toBe(false);
    expect(isPlaybackStalled(false, false, 0, -1)).toBe(false);
  });

  it('아주 미세한 변화는 재생으로 치지 않는다', () => {
    expect(isPlaybackStalled(false, false, 4.2005, 4.2)).toBe(true);
  });
});
