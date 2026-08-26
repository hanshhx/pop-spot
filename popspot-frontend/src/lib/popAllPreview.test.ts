import { describe, expect, it } from 'vitest';
import { popAllPreviewRows } from './popAllPreview';
import type { PopupStore } from '@/types/popup';

const TODAY = new Date(2026, 7, 26);
const TOMORROW = new Date(2026, 7, 27);

/** 사진이 있는 팝업 하나. photoOrigin=CRAWLED 라야 popupCoverUrl 이 URL 을 돌려준다. */
function popup(id: number, category: string, overrides: Partial<PopupStore> = {}): PopupStore {
  return {
    id,
    name: '팝업 ' + id,
    location: '성수동',
    status: '',
    viewCount: 0,
    category,
    imageUrl: 'https://cdn.example.com/' + id + '.jpg',
    photoOrigin: 'CRAWLED',
    ...overrides,
  } as PopupStore;
}

/** 같은 카테고리 팝업을 n개. id 는 base+1 부터. */
function many(base: number, category: string, n: number): PopupStore[] {
  return Array.from({ length: n }, (_, i) => popup(base + i + 1, category));
}

describe('popAllPreviewRows', () => {
  it('카테고리마다 한 줄씩 만든다', () => {
    const rows = popAllPreviewRows([...many(0, '패션', 12), ...many(100, '뷰티', 12)], TODAY);
    expect(rows.map((r) => r.code).sort()).toEqual(['beauty', 'fashion']);
  });

  it('한 줄에는 열 곳을 담는다', () => {
    const rows = popAllPreviewRows(many(0, '패션', 30), TODAY);
    expect(rows[0].popups).toHaveLength(10);
  });

  it('열 곳이 안 되는 카테고리는 있는 만큼만 담는다', () => {
    const rows = popAllPreviewRows(many(0, '패션', 6), TODAY);
    expect(rows[0].popups).toHaveLength(6);
  });

  it('한 줄 안에 같은 팝업이 두 번 들어가지 않는다', () => {
    // 순환 슬라이스라 목록보다 많이 뽑으려 하면 앞쪽이 다시 나올 수 있다.
    const rows = popAllPreviewRows(many(0, '패션', 6), TODAY);
    const ids = rows[0].popups.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('사진이 없는 팝업은 미리보기에 넣지 않는다', () => {
    // 미리보기의 약속이 "사진과 제목" 이므로, 사진이 없으면 그 약속을 지킬 수 없다.
    const withPhoto = many(0, '패션', 5);
    const noPhoto = many(100, '패션', 5).map((p) => ({ ...p, imageUrl: undefined }));
    const rows = popAllPreviewRows([...withPhoto, ...noPhoto], TODAY);
    expect(rows[0].popups.map((p) => p.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('팝업이 세 곳도 안 되는 카테고리는 줄을 만들지 않는다', () => {
    // 두 칸짜리 가로 스크롤 줄은 스크롤할 것이 없어 줄로서 실패한다.
    const rows = popAllPreviewRows([...many(0, '패션', 12), ...many(100, '뷰티', 2)], TODAY);
    expect(rows.map((r) => r.code)).toEqual(['fashion']);
  });

  it('분류되지 않는 카테고리는 줄을 만들지 않는다', () => {
    // 줄 제목을 지을 수 없는 축은 줄이 될 수 없다.
    const rows = popAllPreviewRows([...many(0, '패션', 12), ...many(100, '어쩌구', 12)], TODAY);
    expect(rows.map((r) => r.code)).toEqual(['fashion']);
  });

  it('기본으로 네 줄까지만 만든다', () => {
    const rows = popAllPreviewRows(
      [
        ...many(0, '패션', 12),
        ...many(100, '뷰티', 12),
        ...many(200, '캐릭터', 12),
        ...many(300, '디저트', 12),
        ...many(400, '아트', 12),
      ],
      TODAY,
    );
    expect(rows).toHaveLength(4);
  });

  it('네 줄이 서로 다른 카테고리를 맡는다', () => {
    // 회전 오프셋을 잘못 잡으면 같은 카테고리가 두 줄을 차지할 수 있다.
    const rows = popAllPreviewRows(
      [
        ...many(0, '패션', 12),
        ...many(100, '뷰티', 12),
        ...many(200, '캐릭터', 12),
        ...many(300, '디저트', 12),
        ...many(400, '아트', 12),
      ],
      TODAY,
    );
    expect(new Set(rows.map((r) => r.code)).size).toBe(4);
  });

  it('같은 날 두 번 불러도 같은 결과를 준다', () => {
    const pool = [...many(0, '패션', 30), ...many(100, '뷰티', 30)];
    expect(popAllPreviewRows(pool, TODAY)).toEqual(popAllPreviewRows(pool, TODAY));
  });

  it('입력 순서가 달라져도 같은 날에는 같은 결과를 준다', () => {
    // 위 테스트만으로는 부족하다 — 같은 배열을 두 번 넣으면 정렬이 없어도 통과한다.
    // 실제로는 /api/popups 가 주는 순서가 응답마다 달라질 수 있고, 그때도 결과가 같아야
    // "같은 날은 같은 열 곳" 이라는 약속이 유지된다. 뒤집은 입력이 그 약속을 검사한다.
    const pool = [
      ...many(0, '패션', 30),
      ...many(100, '뷰티', 30),
      ...many(200, '캐릭터', 30),
      ...many(300, '디저트', 30),
      ...many(400, '아트', 30),
    ];
    expect(popAllPreviewRows([...pool].reverse(), TODAY)).toEqual(popAllPreviewRows(pool, TODAY));
  });

  it('하루가 지나면 줄 안의 팝업이 달라진다', () => {
    // 매일 같은 열 곳만 보여주면 재방문자에게 이 자리는 두 번째부터 죽은 칸이 된다.
    const pool = many(0, '패션', 30);
    const before = popAllPreviewRows(pool, TODAY)[0].popups.map((p) => p.id);
    const after = popAllPreviewRows(pool, TOMORROW)[0].popups.map((p) => p.id);
    expect(after).not.toEqual(before);
  });

  it('하루가 지나면 보여주는 카테고리 조합도 달라진다', () => {
    const pool = [
      ...many(0, '패션', 12),
      ...many(100, '뷰티', 12),
      ...many(200, '캐릭터', 12),
      ...many(300, '디저트', 12),
      ...many(400, '아트', 12),
    ];
    const before = popAllPreviewRows(pool, TODAY).map((r) => r.code);
    const after = popAllPreviewRows(pool, TOMORROW).map((r) => r.code);
    expect(after).not.toEqual(before);
  });

  it('빈 목록에는 줄을 만들지 않는다', () => {
    expect(popAllPreviewRows([], TODAY)).toEqual([]);
  });

  it('줄 수와 줄당 개수를 불러온 쪽이 정할 수 있다', () => {
    const pool = [...many(0, '패션', 30), ...many(100, '뷰티', 30)];
    const rows = popAllPreviewRows(pool, TODAY, { rowCount: 1, perRow: 3 });
    expect(rows).toHaveLength(1);
    expect(rows[0].popups).toHaveLength(3);
  });
});
