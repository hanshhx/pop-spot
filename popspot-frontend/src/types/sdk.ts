/**
 * 외부 SDK 글로벌 타입.
 *
 * <p>Kakao Maps · YouTube IFrame Player 둘 다 공식 @types 패키지가 부실하거나 없다. 우리가 실제로
 * 쓰는 표면만 최소한으로 선언해 두고, 타입 단정(assertion) 이 필요한 호출 지점에서는 보다 구체적인
 * 헬퍼 타입을 따로 정의해 쓴다.
 *
 * <p>광범위한 SDK 표면을 전부 타입화하지 않는 이유 — Kakao Maps 의 API 가 자주 바뀌고, 우리가 쓰는
 * 부분만 좁게 잡는 것이 유지보수에 유리하기 때문.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Kakao Maps SDK 의 글로벌 진입점. 실제 표면이 매우 넓어 컨테이너만 정의. */
export type KakaoMapsSdk = any;

/** YouTube IFrame Player API 의 글로벌 진입점. */
export type YouTubeIframeSdk = any;

/** YouTube Player 이벤트 객체. `onReady` / `onStateChange` 콜백이 받는 인자. */
export interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data?: number;
}

/** YouTube Player 인스턴스 — 우리가 실제로 호출하는 메서드만 모았다. */
export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}
