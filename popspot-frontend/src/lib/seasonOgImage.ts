import type { Season } from './season';

/**
 * 공유 카드(OG) 이미지 주소.
 *
 * <h3>왜 파일명에 계절을 넣는가</h3>
 *
 * <p>시안 슬라이드 14 — 랜딩은 정적으로 만들어져 CDN 에 캐시된다. 그래서 <b>8월에 만든 카드가
 * 10월에도 나간다.</b> 파일 내용만 갈아치우면 캐시가 옛 그림을 계속 내보내고, 카카오톡·트위터가
 * 자기 쪽에 떠 둔 사본은 더 오래 남는다.
 *
 * <p>파일명이 바뀌면 <b>주소가 바뀌므로</b> 캐시가 통하지 않는다. 계절이 바뀌는 달 1일에
 * 새 주소로 갈아타는 것이 유일하게 확실한 방법이다.
 *
 * <h3>없으면 기본 카드로 물러선다</h3>
 *
 * <p>계절 카드를 아직 안 만들었는데 주소만 적어 두면 공유했을 때 <b>깨진 이미지</b>가 나간다.
 * 카드가 안 나오는 것보다 나쁘다 — 링크가 고장 난 것처럼 보인다. 그래서 "있다고 아는 것" 만
 * 목록에 둔다.
 */

/** 계절 카드가 실제로 있는 계절. 파일을 public/ 에 두고 여기에 추가한다. */
const AVAILABLE: Partial<Record<Season, true>> = {
  // 예) summer: true,  ← public/og-image-summer.png 를 넣은 뒤 주석 해제
};

/** 계절 카드가 없을 때 쓰는 기본 카드. */
export const DEFAULT_OG_IMAGE = '/og-image.png';

/** 이름 규칙 — 있든 없든 하나다. */
export function seasonOgPath(season: Season): string {
  return `/og-image-${season}.png`;
}

/** 지금 내보낼 공유 카드. */
export function ogImageFor(season: Season): string {
  return AVAILABLE[season] ? seasonOgPath(season) : DEFAULT_OG_IMAGE;
}

/** 이 계절 카드가 준비돼 있는가 — 관리자 화면에서 빈 곳을 보여주는 데 쓴다. */
export function hasSeasonOgImage(season: Season): boolean {
  return Boolean(AVAILABLE[season]);
}
