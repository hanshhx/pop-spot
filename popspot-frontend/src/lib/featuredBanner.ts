import { daysUntilEnd } from './dday';

/**
 * 홈 맨 위에 한 줄로 띄우는 <b>주목 팝업</b>.
 *
 * <p><b>왜 상수인가.</b> 제휴로 들어온 건은 아직 한 건이다. 관리 화면과 테이블을 먼저 만들면
 * 쓰는 사람도 데이터도 없는 기능을 유지보수하게 된다. 대신 <b>스스로 사라지는 것</b>만은 코드로
 * 보장한다 — 배너가 남는 사고는 "누가 내리는 것을 잊어서" 나지 "기능이 없어서" 나지 않는다.
 *
 * <p><b>왜 팝업 id 가 비어 있나.</b> 상세 페이지 주소를 만들려면 DB 가 정해 주는 id 가 있어야
 * 하는데, 그것은 등록 SQL 을 돌린 뒤에 나온다. 그때까지는 {@code null} 이고 배너는 안 뜬다 —
 * 눌러도 아무 데도 안 가는 배너를 띄우느니 안 띄우는 쪽이 낫다.
 */
export interface FeaturedPopup {
  /** 상세 주소({@code /popup/{id}})를 만들 값. 등록 전이면 null. */
  popupId: number | null;
  title: string;
  /** 배너 한 줄에 들어갈 장소 — 동네까지만. 도로명은 상세에서 본다. */
  place: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
}

/**
 * 시작 며칠 전부터 띄울까.
 *
 * <p>너무 일찍 띄우면 "이번 주말" 이 아닌데도 자리를 차지하고, 방문자는 매번 같은 배너를 보다가
 * 눈에서 지운다. 2주면 주말 계획을 세우는 사람에게 닿기에 충분하다.
 */
export const SHOW_DAYS_BEFORE = 14;

/** 지금 띄우는 건. 다음 제휴가 오면 이 값을 갈아 끼운다. */
const FEATURED: FeaturedPopup = {
  // 등록 SQL 을 돌린 뒤 나온 id 를 넣는다.
  popupId: null,
  title: '2026 제주 로컬브랜드 팝업스토어',
  place: '성수 · KT&G 상상플래닛',
  imageUrl: '/partner/jeju-2026/01.webp',
  startDate: '2026-09-05',
  endDate: '2026-09-06',
};

/**
 * 이 건을 지금 띄울 것인가.
 *
 * <p>끝난 다음 날 아침에 저절로 사라진다. {@code daysUntilEnd} 가 <b>날짜 단위</b>로 세므로
 * 마지막 날 저녁 6시에 문을 닫아도 그날 하루는 계속 보인다 — 이미 도착한 사람에게 정보가
 * 필요하기 때문이다.
 */
export function pickFeatured(entry: FeaturedPopup, now: Date): FeaturedPopup | null {
  if (entry.popupId === null) return null;

  const untilEnd = daysUntilEnd(entry.endDate, now);
  if (untilEnd === null || untilEnd < 0) return null;

  const untilStart = daysUntilEnd(entry.startDate, now);
  if (untilStart !== null && untilStart > SHOW_DAYS_BEFORE) return null;

  return entry;
}

/** 화면이 부르는 쪽. */
export function activeFeatured(now: Date = new Date()): FeaturedPopup | null {
  return pickFeatured(FEATURED, now);
}

/**
 * 배너 오른쪽에 붙일 남은 날 — 시작 전이면 {@code D-n}, 진행 중이면 오늘까지 세지 않고
 * {@code null} 을 준다(진행 중 표시는 화면이 '진행 중' 문구로 대신한다).
 */
export function daysUntilStart(entry: FeaturedPopup, now: Date): number | null {
  const days = daysUntilEnd(entry.startDate, now);
  return days !== null && days > 0 ? days : null;
}
