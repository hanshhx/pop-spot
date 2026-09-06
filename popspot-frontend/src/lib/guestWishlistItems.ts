/**
 * 비회원이 담아 둔 팝업 id 를 <b>화면에 그릴 수 있는 항목</b>으로 바꾼다.
 *
 * <p><b>왜 이 파일이 생겼나.</b> 홈의 MY 탭은 담아 둔 id 를 목록 데이터({@code catalogPopups})에서
 * 찾아 이름과 사진을 붙였다. 그런데 그 목록은 <b>끝난 팝업을 빼고 온다</b> —
 * {@code PopupStoreRepository} 의 조회가 {@code endDate IS NULL OR endDate >= :today} 로 거른다.
 * 못 찾은 id 는 {@code .filter(Boolean)} 이 버렸다.
 *
 * <p>그래서 <b>담아 둔 팝업이 끝나면 화면에서 조용히 사라졌다.</b> 2026-09-06 운영에서 재현했다:
 *
 * <pre>
 *   저장소 [716, 100]  → 카드 1개 (100 번은 흔적 없음)
 *   저장소 [100]       → "아직 찜한 팝업스토어가 없습니다"
 * </pre>
 *
 * <p>두 번째가 이 파일의 이유다. <b>담아 둔 사람에게 담은 것이 없다고 말한다.</b> 계획서 §5.1 이
 * 금지한 "저장 성공이 확인되지 않으면 저장됨이라고 말하지 않는다" 의 거울상이고, §4.5 의
 * "종료된 저장 기록을 곧바로 지우지 않으며" 와도 정면으로 어긋난다.
 *
 * <p><b>고치는 방법.</b> 목록에 없는 id 는 상세({@code GET /api/popups/{id}})로 따로 가져온다.
 * 끝난 팝업도 상세는 200 을 돌려준다 — 목록에서만 빠져 있을 뿐 자료는 살아 있다.
 *
 * <p>가져오기는 이 파일이 하지 않는다. 조회 함수를 <b>인자로 받는다</b> — 그래야 브라우저도
 * 서버도 없이 시험할 수 있다. {@code migrateGuestWishlist.ts} 와 같은 이유의 같은 모양이다.
 */

import type { PopupStore, WishlistItem } from '@/types/popup';

/**
 * 목록에 없는 id 를 몇 개씩 동시에 가져올지.
 *
 * <p>{@code migrateGuestWishlist} 의 값과 같다. 인프라 비용이 0원이어야 하는 서비스라 한 화면이
 * 순간적으로 수십 개의 요청을 여는 일이 없어야 한다.
 */
const LOOKUP_CONCURRENCY = 4;

/** 목록에 없는 id 하나를 조회한 결과. */
export type PopupLookup =
  /** 찾았다. 끝난 팝업이어도 자료는 온전하다. */
  | { kind: 'found'; popup: PopupStore }
  /** 404 — 지워진 팝업이다. 다시 물어도 같은 답이 온다. */
  | { kind: 'gone' }
  /** 네트워크·서버 오류. <b>다시 물으면 달라질 수 있다.</b> */
  | { kind: 'failed' };

export interface GuestWishlistView {
  /** 그릴 수 있는 항목. <b>담은 순서 그대로.</b> */
  items: WishlistItem[];
  /**
   * 정보를 가져오지 못한 id — 오직 {@code failed} 만 여기 온다.
   *
   * <p><b>{@code gone} 은 넣지 않는다.</b> 지워진 팝업까지 "불러오지 못했어요" 로 세면 다시
   * 시도해도 영영 줄지 않는 숫자가 화면에 박힌다. 사용자가 할 수 있는 일이 없는 안내는
   * 안내가 아니다.
   */
  unresolved: number[];
}

/** 목록 데이터를 찜 항목 모양으로 옮긴다. */
export function popupToWishlistItem(popup: PopupStore): WishlistItem {
  return {
    // 게스트에게는 서버가 준 wishlistId 가 없다. 화면에서 키로만 쓰므로 팝업 id 로 대신한다.
    wishlistId: Number(popup.id),
    popupId: Number(popup.id),
    popupName: popup.name,
    popupImage: popup.imageUrl ?? '',
    location: popup.location ?? '',
    startDate: popup.startDate ?? '',
    endDate: popup.endDate ?? '',
  };
}

/**
 * 담아 둔 id 목록을 화면 항목으로 만든다.
 *
 * <p>목록 데이터에 있는 것은 그대로 쓰고(요청 없음), 없는 것만 {@code lookup} 으로 가져온다.
 * 대부분의 사용자에게 요청은 <b>0건</b>이다 — 끝난 팝업을 담아 둔 사람에게만 몇 건 나간다.
 *
 * <p><b>순서는 담은 순서다.</b> 가져오기가 끝나는 순서로 늘어놓으면 화면을 열 때마다 순서가
 * 달라져, 사용자는 자기가 담은 목록이라고 알아보지 못한다.
 */
export async function buildGuestWishlist(
  savedIds: readonly number[],
  catalog: readonly PopupStore[],
  lookup: (id: number) => Promise<PopupLookup>,
): Promise<GuestWishlistView> {
  const byId = new Map(catalog.map((p) => [Number(p.id), p]));
  const missing = savedIds.filter((id) => !byId.has(id));

  const fetched = new Map<number, PopupStore>();
  const unresolved: number[] = [];

  await pooled(missing, LOOKUP_CONCURRENCY, async (id) => {
    const result = await lookup(id);
    if (result.kind === 'found') fetched.set(id, result.popup);
    else if (result.kind === 'failed') unresolved.push(id);
    // gone — 지워진 팝업. 그릴 것도, 다시 시도할 것도 없다.
  });

  const items = savedIds
    .map((id) => byId.get(id) ?? fetched.get(id))
    .filter((p): p is PopupStore => Boolean(p))
    .map(popupToWishlistItem);

  // 담은 순서대로 — pooled 가 끝나는 순서는 제각각이라 여기서 다시 세운다.
  unresolved.sort((a, b) => savedIds.indexOf(a) - savedIds.indexOf(b));

  return { items, unresolved };
}

async function pooled<T>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await work(item);
    }
  });
  await Promise.all(lanes);
}
