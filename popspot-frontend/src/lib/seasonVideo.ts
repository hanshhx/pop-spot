import type { Season } from './season';

/**
 * 계절 × 라이트/다크 배경 영상.
 *
 * <p>배경 영상은 <b>홈 첫 방문 전송량의 대부분</b>을 차지한다. 그래서 여덟 편을 한꺼번에 두는
 * 대신, 실제로 파일을 넣은 칸만 채우고 나머지는 기존 두 편으로 떨어지게 한다. 파일을 넣기 전에
 * 경로부터 적어 두면 없는 주소를 받으러 갔다가 배경이 통째로 비는데, 그건 계절감을 더하려다
 * 원래 있던 것까지 잃는 거래다.
 *
 * <p>새 영상을 넣는 순서는 이렇다.
 *
 * <ol>
 *   <li>{@code public/bg/{season}-{light|dark}.mp4} 로 파일을 넣는다.</li>
 *   <li>아래 {@code SEASON_BG} 에서 그 칸의 {@code null} 을 경로로 바꾼다.</li>
 * </ol>
 *
 * <p>여덟 편은 4K 원본에서 <b>1280x720 · 무음 · faststart</b> 로 줄였다. 프레임레이트는 원본을
 * 그대로 둔다 — 30→24 로 낮추면 5프레임마다 하나를 버려 패닝 샷에서 저더가 보인다.
 *
 * <p><b>화질이 아니라 용량을 고정한다.</b> 처음엔 기존 두 편과 같은 CRF 로 떴는데 가을 라이트만
 * 12.9MB 가 나왔다. 화질을 묶으면 용량이 소재를 따라가고, 나뭇잎에 카메라까지 움직이는 그림은
 * 벚꽃보다 일곱 배를 먹는다. 2패스로 비트레이트를 못박으니 여덟 편 전부 1.5~2.1MB 로,
 * 이미 쓰던 두 편(0.7MB · 2.8MB) 안쪽에 들어온다.
 *
 * <p>인코딩 전에 {@code hqdn3d} 로 그레인을 지운다. 무작위 노이즈는 움직임 예측이 통하지 않아
 * 비트를 가장 많이 먹는데, 스크림 뒤에서는 그 디테일이 보이지도 않는다. 다만 겨울 라이트는
 * <b>노이즈처럼 보이는 것이 곧 내리는 눈</b>이라 거의 걸지 않았다.
 *
 * <p>짧은 세 편(달·단풍·설림)은 앞뒤로 한 번씩 이어 붙여 끝과 처음을 같은 프레임으로 만들었다.
 * 6초짜리를 그대로 두면 크로스페이드가 쉴 새 없이 걸린다.
 */

/** 계절 영상이 아직 없을 때 쓰는, 지금까지 쓰던 두 편. */
const BASE_LIGHT = '/light-bg.mp4';
const BASE_DARK = '/login-bg-v2.mp4';

/**
 * 계절별 배경 영상 경로. {@code null} 은 "아직 파일 없음" 이고 기본 영상으로 떨어진다.
 *
 * <p>런타임에 파일이 있는지 찔러 보지 않고 여기 적힌 대로만 믿는다 — 없는 주소를 받아 보고
 * 실패하면 그 사이 배경이 비고, 실패를 캐시하는 브라우저에서는 새로고침해도 안 돌아온다.
 */
export type SeasonBgManifest = Record<Season, { light: string | null; dark: string | null }>;

export const SEASON_BG: SeasonBgManifest = {
  spring: { light: '/bg/spring-light.mp4', dark: '/bg/spring-dark.mp4' },
  summer: { light: '/bg/summer-light.mp4', dark: '/bg/summer-dark.mp4' },
  autumn: { light: '/bg/autumn-light.mp4', dark: '/bg/autumn-dark.mp4' },
  winter: { light: '/bg/winter-light.mp4', dark: '/bg/winter-dark.mp4' },
};

export interface SeasonBgVideo {
  src: string;
  /**
   * 재생 속도. 라이트는 도심 불빛 반짝임이 커서 0.5 배속으로 차분하게 깔고, 다크(야경)는
   * 원속도를 유지한다 — 기존 두 편에서 쓰던 값을 그대로 이어받는다.
   */
  rate: number;
  /** 계절 전용 영상이 실제로 걸렸는지. 계절 파일이 없어 기본 영상으로 떨어졌으면 false. */
  seasonal: boolean;
}

/** 지금 화면이 깔아야 할 배경 영상. {@code manifest} 는 테스트에서만 갈아 끼운다. */
export function seasonBgVideo(
  season: Season,
  dark: boolean,
  manifest: SeasonBgManifest = SEASON_BG,
): SeasonBgVideo {
  const mode = dark ? 'dark' : 'light';
  const seasonal = manifest[season][mode];
  return {
    src: seasonal ?? (dark ? BASE_DARK : BASE_LIGHT),
    rate: dark ? 1 : 0.5,
    seasonal: seasonal != null,
  };
}
