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

/**
 * 팝업 상세·랜딩이 내보낼 공유 카드 — <b>절대 비지 않는다.</b>
 *
 * <p>실측(2026-09-01): 홈에만 {@code og:image} 가 있고 상세·랜딩에는 <b>한 장도 없었다.</b>
 * Next 의 metadata 는 자식의 {@code openGraph} 가 부모 것을 <b>통째로 대체</b>하므로, 자식이
 * {@code images} 를 안 쓰면 루트의 카드까지 같이 사라진다. 그래서 카톡·네이버 공유 카드가 빈 채로
 * 나갔다.
 *
 * <p><b>팝업 사진을 쓰지 않는 이유.</b> 살아 있는 팝업 1,405건의 {@code photoOrigin} 이
 * PEXELS(1,184) 아니면 PLACEHOLDER(221)다 — <b>실제 팝업 사진이 한 장도 없다.</b> 화면에서는
 * "연출 이미지 · 실제 팝업 현장 아님" 을 붙여 두지만 공유 카드에는 그 고지를 붙일 자리가 없다.
 * 스톡 사진을 그 팝업의 사진인 것처럼 내보내는 것은 거짓이므로, 브랜드 카드로 간다.
 *
 * <p>나중에 진짜 사진이 들어오면({@code photoOrigin} 이 CRAWLED·USER) 그것이 우선한다 —
 * 판정은 {@code verifiedPopupImage} 가 이미 하고 있다.
 */
export function shareCardFor(verifiedImage: string | null | undefined): string {
  return verifiedImage?.trim() ? verifiedImage.trim() : DEFAULT_OG_IMAGE;
}

/** 이 계절 카드가 준비돼 있는가 — 관리자 화면에서 빈 곳을 보여주는 데 쓴다. */
export function hasSeasonOgImage(season: Season): boolean {
  return Boolean(AVAILABLE[season]);
}
