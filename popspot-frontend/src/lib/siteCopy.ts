/**
 * 사이트 전역에서 되풀이되는 "사실 기반" 카피의 단일 출처.
 *
 * <p>여기 모아두는 이유: 크롤러 스케줄 같은 값이 홈 SEO 블록·랜딩·FAQ 여러 곳에 하드코딩돼 있으면
 * 스케줄을 바꿀 때 한 곳만 고치고 나머지는 잊어버려, 색인된 페이지가 사실과 다른 정보를 광고하게 된다.
 * (실제로 랜딩에는 상수를 뒀는데 홈에는 문자열이 박혀 있어 그 사고가 날 뻔했다.)
 *
 * <p>크롤러 주기를 바꾸면 <b>이 파일만</b> 고치면 된다.
 */

/** 자동 수집 주기 — 백엔드 popspot.crawler.cron / cron-afternoon 과 반드시 일치시킬 것. */
export const CRAWL_REFRESH_COPY = '매일 04·16시';

/** 문장 안에 넣을 때 쓰는 형태. 예: "…{CRAWL_REFRESH_SENTENCE}되는 서울 팝업스토어 추천" */
export const CRAWL_REFRESH_SENTENCE = `${CRAWL_REFRESH_COPY} 자동 업데이트`;
