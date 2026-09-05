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

/**
 * 지금 띄우는 건들. 새 제보·제휴가 오면 <b>줄을 추가</b>한다 — 갈아 끼우지 않는다.
 *
 * <p><b>왜 목록인가.</b> 처음에는 한 건짜리 상수였는데, 그러면 기간이 겹칠 때 한쪽을 내려야 한다.
 * 실제로 2026-09-05 에 제주(~09-06)가 하루 남은 상태에서 릴 건이 들어와, 갈아 끼우면 제주의
 * 마지막 날이 날아가는 상황이 됐다. 목록이면 겹치는 동안 둘 다 뜨고 끝난 것부터 저절로 빠진다.
 *
 * <p><b>지난 건도 지우지 않는다.</b> {@link pickFeatured} 가 끝난 다음 날 알아서 걸러내므로
 * 남겨 두어도 화면에는 안 나온다. 지우려다 살아 있는 줄을 건드리는 것보다 낫고, 무엇을 언제
 * 띄웠는지가 이 파일에 그대로 남는다.
 */
const FEATURED: FeaturedPopup[] = [
  {
    // 2026-09-01 등록. popup_store_seq 가 준 번호다.
    popupId: 5619,
    title: '2026 제주 로컬브랜드 팝업스토어',
    place: '성수 · KT&G 상상플래닛',
    imageUrl: '/partner/jeju-2026/01.webp',
    startDate: '2026-09-05',
    endDate: '2026-09-06',
  },
  {
    // 2026-09-05 제보 접수·등록. popup_store_seq 가 준 번호다.
    popupId: 6291,
    title: '릴 X 토니노 람보르기니 GROUND',
    place: '성수 · 성수이로 72',
    imageUrl: '/partner/lil-lamborghini-2026/01.webp',
    startDate: '2026-09-15',
    endDate: '2026-09-23',
  },
];

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

/**
 * 지금 띄울 것들을 <b>끝나는 순서대로</b> 고른다.
 *
 * <p>정렬 기준이 시작일이 아니라 종료일인 이유 — 겹쳐 뜰 때 위에 와야 하는 것은 곧 닫히는
 * 쪽이다. 아직 2주 남은 건은 다음에 와도 늦지 않지만, 내일 끝나는 건은 오늘 못 보면 끝이다.
 */
export function pickAll(entries: FeaturedPopup[], now: Date): FeaturedPopup[] {
  return entries
    .map((entry) => pickFeatured(entry, now))
    .filter((entry): entry is FeaturedPopup => entry !== null)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}

/** 화면이 부르는 쪽. 띄울 것이 없으면 빈 배열이다. */
export function activeFeatured(now: Date = new Date()): FeaturedPopup[] {
  return pickAll(FEATURED, now);
}

/**
 * 배너 오른쪽에 붙일 남은 날 — 시작 전이면 {@code D-n}, 진행 중이면 오늘까지 세지 않고
 * {@code null} 을 준다(진행 중 표시는 화면이 '진행 중' 문구로 대신한다).
 */
export function daysUntilStart(entry: FeaturedPopup, now: Date): number | null {
  const days = daysUntilEnd(entry.startDate, now);
  return days !== null && days > 0 ? days : null;
}

/**
 * 이 화면에 띄울 것인가 — <b>제휴 팝업 자신의 상세에서는 안 띄운다.</b>
 *
 * <p>배너는 그 팝업의 상세로 보내는 링크다. 이미 그 화면에 와 있는 사람에게 같은 곳으로 가라고
 * 권하는 배너는 자리만 차지하고, 눌러도 화면이 안 바뀌어 <b>고장으로 읽힌다</b>.
 *
 * <p>비교를 문자열로 하는 이유 — 팝업 id 가 화면마다 다른 모양으로 온다. 라우트 파라미터는
 * 문자열이고 객체 필드는 숫자다. 어느 쪽이 와도 같은 답이 나와야 한다.
 */
export function pickForPage(
  entry: FeaturedPopup,
  currentPopupId: number | string | null | undefined,
  now: Date,
): FeaturedPopup | null {
  const featured = pickFeatured(entry, now);
  if (!featured) return null;
  if (currentPopupId != null && String(currentPopupId) === String(featured.popupId)) return null;
  return featured;
}

/** 한 화면에 띄울 것들. 지금 보고 있는 팝업을 가리키는 줄만 빠진다. */
export function pickAllForPage(
  entries: FeaturedPopup[],
  currentPopupId: number | string | null | undefined,
  now: Date,
): FeaturedPopup[] {
  return pickAll(entries, now).filter(
    (entry) => currentPopupId == null || String(currentPopupId) !== String(entry.popupId),
  );
}

/** 화면이 부르는 쪽. {@code currentPopupId} 를 주면 그 팝업의 상세에서는 그 줄만 빠진다. */
export function featuredForPage(
  currentPopupId?: number | string | null,
  now: Date = new Date(),
): FeaturedPopup[] {
  return pickAllForPage(FEATURED, currentPopupId, now);
}
