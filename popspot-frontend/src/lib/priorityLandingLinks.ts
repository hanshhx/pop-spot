/**
 * 실제 검색 유입·노출이 확인된 핵심 랜딩 페이지.
 *
 * 새 페이지를 대량 생성하는 목록이 아니다. 이미 존재하고 검색 수요가 확인된 페이지를 홈과 관련
 * 랜딩에서 먼저 찾게 하는 내부 탐색 순서다. 이름에 월을 고정하지 않아 다음 달에도 문구가 낡지 않는다.
 */
export const PRIORITY_LANDING_LINKS = [
  {
    slug: 'yongsan-this-month',
    kind: 'region-period',
    label: '용산 이번 달 팝업',
    labelEn: 'Yongsan pop-ups this month',
    labelJa: '今月のヨンサンのポップアップ',
  },
  {
    slug: 'the-hyundai',
    kind: 'brand',
    label: '더현대 서울 팝업',
    labelEn: 'The Hyundai Seoul pop-ups',
    labelJa: 'ザ・ヒョンデ・ソウルのポップアップ',
  },
  {
    slug: 'jamsil',
    kind: 'region',
    label: '잠실 팝업',
    labelEn: 'Jamsil pop-ups',
    labelJa: 'チャムシルのポップアップ',
  },
  {
    slug: 'seongsu',
    kind: 'region',
    label: '성수 팝업',
    labelEn: 'Seongsu pop-ups',
    labelJa: 'ソンスのポップアップ',
  },
  {
    slug: 'hongdae',
    kind: 'region',
    label: '홍대 팝업',
    labelEn: 'Hongdae pop-ups',
    labelJa: 'ホンデのポップアップ',
  },
  {
    // 8/14~8/19 Google 실측에서 223회 노출·34회 클릭(15.2%). 한때의 행사명이 아니라
    // 계속 쓰이는 장소 페이지라 홈의 고정 연결로 두어도 문구가 낡지 않는다.
    slug: 'coex',
    kind: 'region',
    label: '코엑스 팝업',
    labelEn: 'COEX pop-ups',
    labelJa: 'COEXのポップアップ',
  },
] as const;
