/**
 * 홈이 검색 결과에 내보내는 문장.
 *
 * <p><b>왜 숫자를 넣나.</b> 실측(2026-09-03, 8/26~9/1) 홈은 노출 1,576에 클릭 33, CTR 2.09%였다.
 * 같은 자료로 낸 6~7위대 평균 CTR 은 4.48% — <b>제 자리 값의 절반</b>이다. 순위(7.15위)가 아니라
 * 문장이 문제라는 뜻이다.
 *
 * <p>랜딩은 v2.43 에서 같은 처방을 이미 받았다. "어느 페이지에 붙여도 말이 되는 문장" 을 건수와
 * 날짜로 바꿨더니 CTR 이 움직였고, 그 경위가 랜딩 메타 함수 주석에 남아 있다. <b>홈만 그 처방에서
 * 빠져 있었다.</b>
 *
 * <p>브랜드 검색어가 <b>0건</b>이라는 것도 함께 봐야 한다. 아무도 "팝스팟" 을 찾지 않으므로 홈은
 * 오직 "서울 팝업" 같은 일반어로만 발견된다. 그 자리에서 옆에 뜨는 블로그가 "9/10까지 성수동" 을
 * 보여줄 때, 우리 문장에 숫자가 하나도 없으면 고를 이유가 없다.
 */

/** 마감이 이만큼 남은 것까지 "임박" 으로 센다. */
export const CLOSING_SOON_DAYS = 3;

/** 숫자를 못 구했을 때 쓰는 옛 문장. 값이 없다고 페이지가 죽으면 안 된다. */
export const FALLBACK_TITLE = '서울 팝업스토어 일정·지도 | 오늘·이번주 여는 팝업 한눈에';
export const FALLBACK_DESCRIPTION =
  '서울 팝업스토어 일정·위치를 지도 한 장에. 오늘·이번 주·주말 여는 성수·홍대·강남 팝업과 마감 임박까지 가입 없이 한눈에.';

export interface HomeCounts {
  /** 지금 열려 있는 팝업 수. */
  open: number;
  /** 그중 곧 마감하는 수. */
  closingSoon: number;
}

/**
 * 제목·설명을 만든다.
 *
 * <p>{@code counts} 가 없거나 열린 팝업이 0곳이면 옛 문장으로 돌아간다 — <b>"0곳" 은 클릭을 부르지
 * 않는다.</b> 랜딩이 0곳일 때 색인에서 빼는 것과 같은 판단이다.
 */
export function homeMeta(counts: HomeCounts | null | undefined): {
  title: string;
  description: string;
} {
  if (!counts || !Number.isFinite(counts.open) || counts.open <= 0) {
    return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };
  }

  const soon = Number.isFinite(counts.closingSoon) ? Math.max(0, counts.closingSoon) : 0;
  return {
    title: `서울 팝업스토어 ${counts.open}곳 일정·지도 | 오늘 여는 팝업·마감 임박`,
    description:
      `지금 서울에서 여는 팝업 ${counts.open}곳` +
      (soon > 0 ? `, 그중 ${soon}곳이 ${CLOSING_SOON_DAYS}일 안에 마감` : '') +
      '. 일정·위치·종료일을 지도 한 화면에서 가입 없이 확인.',
  };
}
