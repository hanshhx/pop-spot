import { describe, expect, it, vi } from 'vitest';

import { type PopupLookup, buildGuestWishlist, popupToWishlistItem } from './guestWishlistItems';
import type { PopupStore } from '@/types/popup';

/**
 * <b>담아 둔 것은 사라지지 않는다.</b>
 *
 * <p>이 파일이 지키는 것 하나: 저장소에 id 가 있으면 화면에도 무언가 있어야 한다. 2026-09-06
 * 운영에서 저장소에 `[100]` 을 둔 채 "아직 찜한 팝업스토어가 없습니다" 가 뜨는 것을 재현했고,
 * 원인은 목록 조회가 끝난 팝업을 빼고 오는데 그 목록으로만 이름을 찾았기 때문이다.
 */

const popup = (id: number, over: Partial<PopupStore> = {}): PopupStore =>
  ({
    id,
    name: `팝업 ${id}`,
    imageUrl: `https://img/${id}.jpg`,
    location: '서울',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    ...over,
  }) as PopupStore;

const found = (p: PopupStore): PopupLookup => ({ kind: 'found', popup: p });
const gone: PopupLookup = { kind: 'gone' };
const failed: PopupLookup = { kind: 'failed' };

const never = () => {
  throw new Error('목록에 있는 것은 조회하면 안 된다');
};

describe('목록에 있는 것', () => {
  it('요청 없이 그대로 쓴다', async () => {
    const view = await buildGuestWishlist([1, 2], [popup(1), popup(2)], never);
    expect(view.items.map((i) => i.popupId)).toEqual([1, 2]);
    expect(view.unresolved).toEqual([]);
  });

  it('목록에 없는 것만 조회한다 — 대부분의 사용자에게 요청은 0건이다', async () => {
    const lookup = vi.fn(async () => found(popup(9)));
    await buildGuestWishlist([1, 2, 9], [popup(1), popup(2)], lookup);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith(9);
  });
});

describe('끝난 팝업 — 이 파일이 생긴 이유', () => {
  /*
   * 목록 조회가 endDate >= today 로 거르므로, 끝난 팝업은 catalog 에 없다.
   * 상세는 200 을 돌려주므로 거기서 가져온다.
   */
  it('목록에 없어도 상세로 가져와 그린다', async () => {
    const ended = popup(100, { name: '블루보틀', endDate: '2024.04.30' });
    const view = await buildGuestWishlist([100], [], async () => found(ended));
    expect(view.items).toHaveLength(1);
    expect(view.items[0].popupName).toBe('블루보틀');
    expect(view.items[0].endDate).toBe('2024.04.30');
  });

  it('저장소에 끝난 것만 있어도 빈 목록이 되지 않는다', async () => {
    const view = await buildGuestWishlist([100], [], async () => found(popup(100)));
    expect(view.items).not.toHaveLength(0);
  });

  it('산 것과 끝난 것이 섞여 있으면 둘 다 나온다', async () => {
    const view = await buildGuestWishlist([716, 100], [popup(716)], async () => found(popup(100)));
    expect(view.items.map((i) => i.popupId)).toEqual([716, 100]);
  });
});

describe('담은 순서를 지킨다', () => {
  /*
   * 가져오기가 끝나는 순서로 늘어놓으면 열 때마다 순서가 달라져, 사용자가 자기 목록으로
   * 알아보지 못한다. 아래는 나중에 요청한 것이 먼저 끝나는 상황이다.
   */
  it('가져오기가 끝나는 순서가 아니라 담은 순서다', async () => {
    const delays: Record<number, number> = { 10: 30, 20: 1, 30: 15 };
    const lookup = async (id: number): Promise<PopupLookup> => {
      await new Promise((r) => setTimeout(r, delays[id]));
      return found(popup(id));
    };
    const view = await buildGuestWishlist([10, 20, 30], [], lookup);
    expect(view.items.map((i) => i.popupId)).toEqual([10, 20, 30]);
  });

  it('목록에 있는 것과 가져온 것이 섞여도 담은 순서다', async () => {
    const view = await buildGuestWishlist([5, 100, 7], [popup(5), popup(7)], async () =>
      found(popup(100)),
    );
    expect(view.items.map((i) => i.popupId)).toEqual([5, 100, 7]);
  });
});

describe('가져오지 못한 것', () => {
  /*
   * gone(404) 과 failed(네트워크·서버) 를 가른다. 지워진 팝업까지 "불러오지 못했어요" 로 세면
   * 다시 시도해도 영영 줄지 않는 숫자가 화면에 박힌다 — 사용자가 할 수 있는 일이 없다.
   */
  it('네트워크 실패는 알린다', async () => {
    const view = await buildGuestWishlist([1, 42], [popup(1)], async () => failed);
    expect(view.items.map((i) => i.popupId)).toEqual([1]);
    expect(view.unresolved).toEqual([42]);
  });

  it('지워진 팝업(404)은 알리지 않는다 — 다시 시도해도 달라지지 않는다', async () => {
    const view = await buildGuestWishlist([1, 42], [popup(1)], async () => gone);
    expect(view.items.map((i) => i.popupId)).toEqual([1]);
    expect(view.unresolved).toEqual([]);
  });

  it('실패한 것도 담은 순서로 알린다', async () => {
    const view = await buildGuestWishlist([9, 8, 7], [], async () => failed);
    expect(view.unresolved).toEqual([9, 8, 7]);
  });
});

describe('빈 값', () => {
  it('담은 것이 없으면 빈 목록이고 조회하지 않는다', async () => {
    const view = await buildGuestWishlist([], [popup(1)], never);
    expect(view.items).toEqual([]);
    expect(view.unresolved).toEqual([]);
  });
});

describe('항목 변환', () => {
  it('없는 값은 빈 문자열로 — 화면이 undefined 를 그리지 않게', () => {
    const item = popupToWishlistItem({ id: 3, name: '이름만' } as PopupStore);
    expect(item).toEqual({
      wishlistId: 3,
      popupId: 3,
      popupName: '이름만',
      popupImage: '',
      location: '',
      startDate: '',
      endDate: '',
    });
  });
});
