import type { PopupStore } from '@/types/popup';
import { CATEGORIES, classifyCategory, type CategoryCode } from './popupSlices';
import { popupCoverUrl } from './popupCover';

/** 미리보기에 세울 줄 수. 벤토 타일 높이에 네 줄이 들어간다. */
export const PREVIEW_ROW_COUNT = 4;
/** 한 줄에 담을 팝업 수. 가로 스크롤로 훑는다. */
export const PREVIEW_PER_ROW = 10;
/** 이보다 적으면 줄을 만들지 않는다 — 스크롤할 것이 없는 줄은 줄이 아니다. */
const MIN_ROW_SIZE = 3;

export interface PreviewRow {
  code: CategoryCode;
  /** 그 분야의 <b>전체</b> 곳수. 곳수 칩이 말하는 수이고, 사진 유무와 무관하다. */
  total: number;
  /** 줄에 깔 사진 카드. 사진이 있는 것만 담는다. */
  popups: PopupStore[];
}

/**
 * 하루 단위로 바뀌는 정수 씨앗.
 *
 * <p>난수를 쓰지 않는 이유는 두 가지다. 렌더할 때마다 달라지면 스크롤만 해도 목록이 바뀌어
 * 사람이 방금 본 것을 다시 찾지 못하고, 테스트로 고정할 수도 없다. 날짜를 씨앗으로 삼으면
 * <b>같은 날은 항상 같고 다음 날은 반드시 다르다</b>.
 */
function daySeed(today: Date): number {
  return Math.floor(today.getTime() / 86_400_000);
}

/**
 * 배열을 offset 부터 순환하며 count 개 뽑는다.
 *
 * <p>count 가 길이보다 크면 있는 만큼만 준다 — 모자란 자리를 앞쪽으로 다시 채우면 한 줄에
 * 같은 팝업이 두 번 나온다.
 */
function cyclicSlice<T>(items: T[], offset: number, count: number): T[] {
  const n = Math.min(count, items.length);
  const start = ((offset % items.length) + items.length) % items.length;
  return Array.from({ length: n }, (_, i) => items[(start + i) % items.length]);
}

/**
 * POP-ALL 미리보기의 줄들 — <b>카테고리마다 한 줄, 한 줄에 열 곳</b>.
 *
 * <p><b>왜 카테고리별인가.</b> 이 자리가 맡은 일은 "전체가 있다" 는 <i>주장</i>이 아니라
 * 넓이를 <b>보여주는</b> 것이다. 인기순 열 곳을 늘어놓으면 옆 자리(POP-LOOK 랭킹)와 같은
 * 화면이 되고, 최신순으로 늘어놓으면 그 옆(최근 오픈한 팝업 레일)과 같아진다. 축을
 * 카테고리로 잡아야 세 자리가 서로 다른 일을 한다.
 *
 * <p><b>왜 매일 도는가.</b> 고정 목록이면 재방문자에게 두 번째 방문부터 죽은 칸이 된다.
 * 카테고리 조합과 줄 안의 시작점을 모두 날짜로 돌려, 같은 날은 안정적이고 다음 날은 새롭다.
 *
 * <p><b>사진 없는 팝업은 뺀다.</b> 이 자리의 약속이 "사진과 제목" 이라서다. 회색 상자로
 * 채운 줄은 넓이를 보여주기는커녕 데이터가 부실하다는 인상만 남긴다.
 */
export function popAllPreviewRows(
  popups: PopupStore[],
  today: Date,
  options: { rowCount?: number; perRow?: number } = {},
): PreviewRow[] {
  const rowCount = options.rowCount ?? PREVIEW_ROW_COUNT;
  const perRow = options.perRow ?? PREVIEW_PER_ROW;

  /*
   * 두 가지를 따로 센다.
   *
   * <p>{@code total} 은 <b>그 분야의 전체 곳수</b>다 — 곳수 칩("148곳")이 말하는 수이고, 사진이
   * 있든 없든 전부 센다. 사진 없는 곳도 「전체 보기」로 들어가면 나오므로, 칩이 사진 있는 수만
   * 세면 눌러서 들어간 화면과 숫자가 어긋난다.
   *
   * <p>{@code withPhoto} 는 줄에 실제로 깔 사진 카드다 — 이 자리의 약속이 "사진과 제목" 이라서
   * 사진 없는 곳은 카드로 만들지 않는다.
   */
  const totals = new Map<CategoryCode, number>();
  const withPhoto = new Map<CategoryCode, PopupStore[]>();
  for (const p of popups) {
    const code = classifyCategory(p.category);
    // 'other' 는 사람이 읽을 줄 제목이 없다 — 축이 아니라 나머지 통이다.
    if (code === 'other') continue;
    totals.set(code, (totals.get(code) ?? 0) + 1);
    if (!popupCoverUrl(p)) continue;
    const bucket = withPhoto.get(code);
    if (bucket) bucket.push(p);
    else withPhoto.set(code, [p]);
  }

  // CATEGORIES 순서를 따라 세운다 — Map 삽입 순서(=데이터 도착 순서)에 기대면 백엔드 정렬이
  // 바뀔 때 화면이 조용히 따라 바뀐다.
  const candidates = CATEGORIES.map((c) => c.code).filter(
    (code) => (withPhoto.get(code)?.length ?? 0) >= MIN_ROW_SIZE,
  );
  if (candidates.length === 0) return [];

  const seed = daySeed(today);
  return candidates.slice(0, rowCount).map((code) => {
    // <b>id 내림차순 정렬은 장식이 아니다.</b> 이것이 없으면 순서가 /api/popups 가 준
    // 순서에 그대로 매이고, 그 순서는 응답마다 바뀔 수 있다 — 그러면 "같은 날은 같은 열 곳"
    // 이라는 약속이 조용히 깨진다. 정렬이 그 약속의 유일한 근거다.
    const bucket = [...(withPhoto.get(code) ?? [])].sort((a, b) => b.id - a.id);
    return { code, total: totals.get(code) ?? 0, popups: cyclicSlice(bucket, seed, perRow) };
  });
}
