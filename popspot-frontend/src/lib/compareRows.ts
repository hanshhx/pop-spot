import { bilingual } from './bilingual';
import { periodText } from './periodText';
import { isUrgentPeriod, savedPeriodBadge, type SavedPeriodBadge } from './popupDetailStatus';
import { kstTodayStart } from './popupSlices';

/**
 * 나란히 놓고 볼 셋을 <b>행</b>으로 바꾼다.
 *
 * <p><b>기획은 다섯 칸을 적었는데 셋만 만든다.</b> 마스터 플랜 §4.3 의 비교 항목은
 * 주요 경험·입장 조건·운영 기간·비용·위치인데, 그중 <b>입장 조건과 비용은 만들 수 없다.</b>
 * 값이 비어 있는 게 아니라 <b>담을 그릇이 없다</b> — 엔티티 컬럼, V1~V33 마이그레이션 전체,
 * 목록·상세 DTO, 그리고 결정적으로 <b>LLM 추출 프롬프트</b> 넷 다 그 항목이 없다. 수집을
 * 시도조차 하지 않으므로 크롤러를 다시 돌려도 채워지지 않는다.
 *
 * <p>다섯 칸을 그려 두고 둘을 "정보 없음" 으로 채우면 <b>우리가 모른다는 사실을 카드마다 반복해
 * 보여 주는</b> 화면이 된다. §4.3 자신이 "비교 항목이 없으면 임의 정보를 채우지 않음" 이라고
 * 적어 뒀고, 이 파일이 그 규칙을 코드로 지키는 자리다.
 *
 * <p><b>같은 규칙을 비교 단위로도 적용한다</b> — 지금 고른 셋이 전부 요약이 없으면 요약 행 자체를
 * 만들지 않는다({@link buildCompareRows}). 세 칸이 나란히 비어 있는 줄은 정보가 아니라 소음이다.
 */

/** 비교 카드 한 장이 그리는 데 필요한 것. 전부 {@code popupSummaryCache} 나 홈이 이미 들고 있는 값이다. */
export interface CompareItem {
  popupId: number;
  name: string;
  /** 백엔드가 확신할 때만 채운다. 없으면 원문만 보여준다. */
  nameTranslated?: string | null;
  /**
   * 카드 머리글의 사진. 행을 만드는 데는 안 쓰지만 <b>일부러 같은 객체에 둔다</b> — 머리글과
   * 행이 서로 다른 배열에서 오면 정렬 뒤에 열이 어긋난다({@link buildCompareView} 참고).
   */
  imageUrl?: string | null;
  location: string | null;
  locationTranslated?: string | null;
  openDate: string | null;
  closeDate: string | null;
  /** 50자 안팎의 한 줄 요약. 실측(2026-09-07) 노출 1,396건 중 <b>99.1%가 서로 다르다.</b> */
  description: string | null;
}

export type CompareRowKind = 'location' | 'period' | 'summary';

/**
 * 한 칸. 값이 없으면 칸 자체가 {@code null} 이고, 화면은 그 자리를 비운다.
 *
 * <p>기간 칸은 문구가 아니라 {@link SavedPeriodBadge} 를 그대로 준다. 화면이
 * {@code === '종료'} 로 <b>보이는 글자를 되묻는</b> 방식이면 문구를 옮기는 순간 판단이 빗나간다 —
 * {@code DdayBadge} 와 {@code isUrgentPeriod} 가 같은 이유로 문구와 판단을 갈라 뒀다.
 */
export interface CompareCell {
  /** 크게 보여줄 문자열. */
  text: string;
  /** 그 아래 작게 남길 한국어 원문. 번역이 없거나 원문과 같으면 없다. */
  sub?: string;
  /** 기간 칸에만. 문구와 색은 화면이 이 종류를 보고 정한다. */
  badge?: SavedPeriodBadge;
  /** 강조색으로 그릴 것인가. {@link isUrgentPeriod} 가 정한다 — 화면이 되묻지 않는다. */
  urgent?: boolean;
}

export interface CompareRow {
  kind: CompareRowKind;
  /** {@link CompareItem} 과 <b>같은 순서·같은 길이.</b> 값이 없는 자리는 null. */
  cells: (CompareCell | null)[];
}

function locationCell(item: CompareItem): CompareCell | null {
  const { display, original } = bilingual(item.location, item.locationTranslated);
  const text = display?.trim();
  if (!text) return null;
  const sub = original?.trim();
  return sub ? { text, sub } : { text };
}

function periodCell(item: CompareItem, today: Date): CompareCell | null {
  const text = periodText(item.openDate, item.closeDate);
  // periodText 는 <b>둘 다 없을 때만</b> '-' 를 준다. 한쪽만 아는 것은 모르는 것이 아니다.
  if (text === '-') return null;
  const badge = savedPeriodBadge(item.openDate, item.closeDate, today);
  return { text, ...(badge ? { badge, urgent: isUrgentPeriod(badge) } : {}) };
}

function summaryCell(item: CompareItem): CompareCell | null {
  const text = item.description?.trim();
  return text ? { text } : null;
  // 카테고리로 떨어지는 폴백은 두지 않는다. 실측(2026-09-07)에서 노출 1,396건의 description
  // 결손이 <b>0건</b>이라 그 분기는 DB 기준으로 죽은 코드다. 다만 백엔드 장애 시
  // emergencyMarkerToPopup 이 description 을 '' 로 채우므로, 그때는 이 칸이 null 이 되어
  // 요약 행이 통째로 사라진다 — 없는 것을 지어내지 않는 쪽이 맞다.
}

/**
 * 급한 순서를 매긴다. {@code [묶음, 묶음 안의 순서]} — 작을수록 앞.
 *
 * <p>{@code savedWishlistGroups.urgency} 와 <b>같은 판단</b>이되 모양이 다르다. 마이팝은 저장 목록을
 * 세 묶음(갈 수 있는 것 · 곧 열리는 것 · 지난 것)으로 <b>나눠서</b> 보여주므로 묶음 안에서만
 * 정렬하면 됐다. 비교는 셋을 <b>한 줄에</b> 놓으므로 그 묶음 순서까지 하나의 정렬로 펴야
 * 두 화면이 같은 순서를 낸다.
 *
 * <p>마감일을 모르는 것을 아는 것들 <b>뒤</b>에 두는 이유도 그쪽과 같다 — 앞에 세우면 "제일 급한
 * 것" 자리를 차지하는데 정작 우리는 그것이 급한지조차 모른다. 숨기는 것이 아니다. 칸에
 * "마감일 미정" 이라고 적혀 있다.
 */
function rank(item: CompareItem, today: Date): [number, number] {
  const badge = savedPeriodBadge(item.openDate, item.closeDate, today);
  if (badge === null) return [4, 0]; // 날짜를 아예 못 읽는다. 맨 뒤.
  switch (badge.kind) {
    case 'closing-today':
      return [0, 0];
    case 'closes-in':
      return [0, badge.days];
    case 'open-undated':
      return [1, 0];
    case 'opens-in':
      return [2, badge.days];
    case 'ended':
      return [3, 0];
  }
}

/**
 * 고른 순서를 화면에 보일 순서로 바꾼다. <b>마감이 급한 것부터.</b>
 *
 * <p><b>왜 고른 순서를 그대로 쓰지 않나.</b> 후보를 고르는 곳이 마이팝이고, 그 목록은 이미
 * {@code groupSavedWishlist} 가 마감 급한 순으로 정렬해 놓았다. 비교만 클릭 순서를 쓰면 <b>같은
 * 데이터가 두 화면에서 다른 순서로</b> 보인다 — 위에서 첫 번째였던 것이 비교에서는 가운데에
 * 있게 된다.
 *
 * <p><b>대가도 적어 둔다.</b> 하나를 빼고 다른 것을 넣으면 남은 것들의 자리가 바뀔 수 있다.
 * "왼쪽이 그거였는데" 가 깨지는 것은 실제 불편이고, 그것을 감수하고 두 화면의 일관성을 택했다.
 *
 * <p>같은 순위끼리는 <b>고른 순서를 지킨다.</b> {@code index} 타이브레이크를 명시적으로 쓰지만,
 * <b>그것이 없어도 결과는 같다</b> — {@code Array.prototype.sort} 는 ES2019 부터 명세상 안정
 * 정렬이다. 사보타주로 확인했다(타이브레이크를 지워도 시험 30건이 전부 통과한다). 그러니 이
 * 한 줄은 안전장치가 아니라 <b>의도를 눈에 보이게 두는 것</b>이고, 관련 시험도 보장을 적어 둘
 * 뿐 그 둘을 구별하지는 못한다. 여기 그렇게 적어 두지 않으면 다음 사람이 시험을 근거로
 * "안정성이 검증돼 있다" 고 잘못 읽는다.
 *
 * <p>원본 배열은 바꾸지 않는다 — 호출부가 들고 있는 선택 목록이다.
 */
export function orderCompareItems(
  items: CompareItem[],
  today: Date = kstTodayStart(),
): CompareItem[] {
  return items
    .map((item, index) => ({ item, index, rank: rank(item, today) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.index - b.index)
    .map((entry) => entry.item);
}

/**
 * 행을 만든다. <b>모든 칸이 빈 행은 만들지 않는다.</b>
 *
 * <p><b>여기서 정렬하지 않는다.</b> 넘긴 순서를 그대로 지킨다 — 화면은 같은 배열로 카드 머리글
 * (이름·사진)도 그리는데, 이 함수가 안에서 몰래 정렬하면 <b>머리글은 입력 순서, 행은 정렬된
 * 순서</b>가 되어 열이 어긋난다. 이름은 A 인데 그 아래 기간은 B 의 것이 되는 식이다.
 * 실제로 이 함수가 정렬을 품고 있던 동안 시험이 그 어긋남을 먼저 잡았다.
 *
 * <p>정렬이 필요하면 {@link buildCompareView} 를 쓴다 — 한 번만 정렬하고 그 배열을 함께 돌려주므로
 * 어긋날 수가 없다.
 *
 * @param items 최대 3개. 1개·2개여도 된다(고르는 중이다).
 */
export function buildCompareRows(
  items: CompareItem[],
  today: Date = kstTodayStart(),
): CompareRow[] {
  const rows: CompareRow[] = [
    { kind: 'location', cells: items.map(locationCell) },
    { kind: 'period', cells: items.map((it) => periodCell(it, today)) },
    { kind: 'summary', cells: items.map(summaryCell) },
  ];
  return rows.filter((row) => row.cells.some((cell) => cell !== null));
}

/**
 * 화면이 필요한 것 전부 — <b>정렬된 항목과 그 순서로 만든 행.</b>
 *
 * <p>둘을 함께 돌려주는 것이 이 함수의 존재 이유다. 화면이 정렬을 따로 부르고 행을 따로 만들면
 * 두 배열의 순서가 어긋날 수 있고, 그 버그는 <b>이름 아래에 남의 기간이 붙는</b> 모양으로 나타나
 * 눈으로 알아채기 어렵다. 여기서 한 번만 정렬한다.
 */
export function buildCompareView(
  items: CompareItem[],
  today: Date = kstTodayStart(),
): { items: CompareItem[]; rows: CompareRow[] } {
  const ordered = orderCompareItems(items, today);
  return { items: ordered, rows: buildCompareRows(ordered, today) };
}
