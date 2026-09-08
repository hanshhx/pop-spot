import { describe, expect, it } from 'vitest';

import {
  buildCompareRows,
  buildCompareView,
  orderCompareItems,
  type CompareItem,
} from './compareRows';
import { groupSavedWishlist } from './savedWishlistGroups';
import type { WishlistItem } from '@/types/popup';

/**
 * <b>빈 칸은 정보가 아니다.</b>
 *
 * <p>기획은 비교 항목 다섯을 적었는데 둘(입장 조건·비용)은 담을 그릇 자체가 없어 만들지 않았다.
 * 같은 판단을 비교 단위로도 적용한다 — 지금 고른 셋이 전부 요약이 없으면 요약 행을 만들지
 * 않는다. 세 칸이 나란히 빈 줄은 "우리가 모른다" 를 세 번 말하는 것이다.
 *
 * <p>아래 시험이 지키는 것은 그 규칙과, <b>한쪽만 아는 것을 모르는 것으로 깎지 않기</b>다.
 */

const TODAY = new Date('2026-09-07');

const item = (over: Partial<CompareItem> = {}): CompareItem => ({
  popupId: 1,
  name: '팝업',
  location: '서울 성동구',
  openDate: '2026-09-01',
  closeDate: '2026-09-30',
  description: '한 줄 요약',
  ...over,
});

const rowOf = (rows: ReturnType<typeof buildCompareRows>, kind: string) =>
  rows.find((r) => r.kind === kind);

describe('행 구성', () => {
  it('세 행이 순서대로 나온다 — 위치·기간·요약', () => {
    const rows = buildCompareRows([item(), item(), item()], TODAY);
    expect(rows.map((r) => r.kind)).toEqual(['location', 'period', 'summary']);
  });

  it('칸 수는 항상 넘긴 항목 수와 같다', () => {
    const rows = buildCompareRows([item(), item()], TODAY);
    for (const row of rows) expect(row.cells).toHaveLength(2);
  });

  it('1개만 넘겨도 터지지 않는다', () => {
    // 고르는 중이다. "두 번째를 고르세요" 안내는 화면이 하고, 여기서 막지 않는다.
    expect(() => buildCompareRows([item()], TODAY)).not.toThrow();
    expect(buildCompareRows([item()], TODAY)[0].cells).toHaveLength(1);
  });

  it('빈 목록이면 행이 없다', () => {
    expect(buildCompareRows([], TODAY)).toEqual([]);
  });
});

describe('모든 칸이 비면 그 행을 만들지 않는다', () => {
  it('셋 다 요약이 없으면 요약 행이 사라진다', () => {
    const rows = buildCompareRows(
      [item({ description: null }), item({ description: '' }), item({ description: '   ' })],
      TODAY,
    );
    expect(rowOf(rows, 'summary')).toBeUndefined();
    expect(rows.map((r) => r.kind)).toEqual(['location', 'period']);
  });

  it('하나라도 있으면 행이 남고 없는 칸만 null 이다', () => {
    const rows = buildCompareRows(
      [item({ description: null }), item({ description: '있음' })],
      TODAY,
    );
    const summary = rowOf(rows, 'summary');
    expect(summary?.cells[0]).toBeNull();
    expect(summary?.cells[1]?.text).toBe('있음');
  });

  it('셋 다 위치가 없으면 위치 행이 사라진다', () => {
    const rows = buildCompareRows([item({ location: null }), item({ location: '' })], TODAY);
    expect(rowOf(rows, 'location')).toBeUndefined();
  });

  it('셋 다 날짜가 하나도 없으면 기간 행이 사라진다', () => {
    const rows = buildCompareRows(
      [item({ openDate: null, closeDate: null }), item({ openDate: '', closeDate: '' })],
      TODAY,
    );
    expect(rowOf(rows, 'period')).toBeUndefined();
  });

  it('세 행이 전부 비면 아무 행도 없다', () => {
    const empty = item({ location: null, openDate: null, closeDate: null, description: null });
    expect(buildCompareRows([empty, empty], TODAY)).toEqual([]);
  });
});

describe('기간 — 한쪽만 아는 것은 모르는 것이 아니다', () => {
  it('종료일만 없으면 시작일로 칸을 만든다', () => {
    // 노출 1,396건 중 900건(64.5%)이 이 경우다. 여기서 칸을 없애면 비교의 3분의 2가 빈다.
    const rows = buildCompareRows([item({ openDate: '2026-09-01', closeDate: null })], TODAY);
    expect(rowOf(rows, 'period')?.cells[0]?.text).toBe('09-01 ~');
  });

  it('둘 다 없을 때만 칸이 null 이다', () => {
    const rows = buildCompareRows([item({ openDate: null, closeDate: null }), item()], TODAY);
    expect(rowOf(rows, 'period')?.cells[0]).toBeNull();
    expect(rowOf(rows, 'period')?.cells[1]?.text).toBe('09-01 ~ 09-30');
  });

  it('마감일을 모르면 open-undated 로 말한다', () => {
    // 아무 표시도 안 하면 끝난 것·안 연 것·모르는 것이 전부 똑같이 보인다.
    const rows = buildCompareRows([item({ openDate: '2026-09-01', closeDate: null })], TODAY);
    expect(rowOf(rows, 'period')?.cells[0]?.badge).toEqual({ kind: 'open-undated' });
  });

  it('아직 안 연 것과 마감 임박을 구분한다', () => {
    const rows = buildCompareRows(
      [
        item({ openDate: '2026-09-20', closeDate: '2026-09-30' }),
        item({ openDate: '2026-09-01', closeDate: '2026-09-09' }),
      ],
      TODAY,
    );
    const period = rowOf(rows, 'period');
    expect(period?.cells[0]?.badge?.kind).toBe('opens-in');
    expect(period?.cells[1]?.badge?.kind).toBe('closes-in');
  });

  it('끝난 것은 ended 로 말한다', () => {
    const rows = buildCompareRows(
      [item({ openDate: '2026-08-01', closeDate: '2026-08-10' })],
      TODAY,
    );
    expect(rowOf(rows, 'period')?.cells[0]?.badge).toEqual({ kind: 'ended' });
  });
});

describe('강조는 종류로 정한다 — 보이는 글자를 되묻지 않는다', () => {
  it('마감이 걸린 것만 강조한다', () => {
    const rows = buildCompareRows(
      [item({ openDate: '2026-09-01', closeDate: '2026-09-09' })],
      TODAY,
    );
    expect(rowOf(rows, 'period')?.cells[0]?.urgent).toBe(true);
  });

  it('마감일을 모르는 것은 강조하지 않는다', () => {
    // 마감 임박과 같은 색을 주면 "모른다" 는 사실이 지워진다.
    const rows = buildCompareRows([item({ openDate: '2026-09-01', closeDate: null })], TODAY);
    expect(rowOf(rows, 'period')?.cells[0]?.urgent).toBe(false);
  });

  it('아직 안 연 것과 끝난 것도 강조하지 않는다', () => {
    const rows = buildCompareRows(
      [
        item({ openDate: '2026-09-20', closeDate: '2026-09-30' }),
        item({ openDate: '2026-08-01', closeDate: '2026-08-10' }),
      ],
      TODAY,
    );
    expect(rowOf(rows, 'period')?.cells[0]?.urgent).toBe(false);
    expect(rowOf(rows, 'period')?.cells[1]?.urgent).toBe(false);
  });
});

describe('위치 — 번역이 있으면 원문을 아래 남긴다', () => {
  it('번역명을 크게, 한국어 원문을 작게', () => {
    // 번역명은 이해에는 좋지만 지도 앱에 넣으면 안 나온다. 둘 중 하나를 고르지 않는다.
    const rows = buildCompareRows(
      [item({ location: '서울 성동구', locationTranslated: 'Seongdong-gu' })],
      TODAY,
    );
    expect(rowOf(rows, 'location')?.cells[0]).toEqual({
      text: 'Seongdong-gu',
      sub: '서울 성동구',
    });
  });

  it('번역이 없으면 원문만 남고 sub 는 없다', () => {
    const rows = buildCompareRows([item({ location: '서울 성동구' })], TODAY);
    expect(rowOf(rows, 'location')?.cells[0]).toEqual({ text: '서울 성동구' });
  });

  it('번역이 원문과 같으면 병기하지 않는다', () => {
    const rows = buildCompareRows([item({ location: '서울', locationTranslated: '서울' })], TODAY);
    expect(rowOf(rows, 'location')?.cells[0]).toEqual({ text: '서울' });
  });
});

describe('순서 — 마감이 급한 것부터', () => {
  const named = (name: string, openDate: string | null, closeDate: string | null) =>
    item({ name, openDate, closeDate });

  const 오늘마감 = named('오늘마감', '2026-09-01', '2026-09-07');
  const 이틀 = named('이틀', '2026-09-01', '2026-09-09');
  const 스무날 = named('스무날', '2026-09-01', '2026-09-27');
  const 마감미정 = named('마감미정', '2026-09-01', null);
  const 곧열림 = named('곧열림', '2026-09-10', '2026-09-20');
  const 나중열림 = named('나중열림', '2026-09-25', '2026-09-30');
  const 끝남 = named('끝남', '2026-08-01', '2026-08-10');
  const 날짜없음 = named('날짜없음', null, null);

  const order = (items: CompareItem[]) => orderCompareItems(items, TODAY).map((i) => i.name);

  it('마감이 가까운 것이 앞에 온다', () => {
    expect(order([스무날, 오늘마감, 이틀])).toEqual(['오늘마감', '이틀', '스무날']);
  });

  it('마감일을 모르는 것은 아는 것들 뒤에 둔다', () => {
    // 앞에 세우면 "제일 급한 것" 자리를 차지하는데, 정작 그것이 급한지조차 모른다.
    expect(order([마감미정, 스무날])).toEqual(['스무날', '마감미정']);
  });

  it('아직 안 연 것은 열려 있는 것들 뒤, 빨리 여는 순', () => {
    expect(order([나중열림, 마감미정, 곧열림])).toEqual(['마감미정', '곧열림', '나중열림']);
  });

  it('끝난 것은 그 뒤, 날짜를 못 읽는 것이 맨 마지막', () => {
    expect(order([날짜없음, 끝남, 곧열림])).toEqual(['곧열림', '끝남', '날짜없음']);
  });

  it('전부 섞어도 갈 수 있는 것 → 미정 → 예정 → 끝남 → 모름', () => {
    expect(order([끝남, 날짜없음, 곧열림, 마감미정, 이틀])).toEqual([
      '이틀',
      '마감미정',
      '곧열림',
      '끝남',
      '날짜없음',
    ]);
  });

  it('같은 순위면 고른 순서를 지킨다', () => {
    const a = named('a', '2026-09-01', '2026-09-09');
    const b = named('b', '2026-09-01', '2026-09-09');
    expect(order([b, a])).toEqual(['b', 'a']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    // 호출부가 들고 있는 선택 목록이다.
    const input = [스무날, 오늘마감];
    orderCompareItems(input, TODAY);
    expect(input.map((i) => i.name)).toEqual(['스무날', '오늘마감']);
  });

  it('buildCompareRows 는 정렬하지 않는다 — 넘긴 순서를 지킨다', () => {
    // 이 함수가 안에서 정렬하면 화면이 카드 머리글은 입력 순서로, 행은 정렬 순서로 그려
    // 열이 어긋난다. 이름 아래에 남의 기간이 붙는 모양이라 눈으로 알아채기 어렵다.
    const rows = buildCompareRows([스무날, 오늘마감], TODAY);
    expect(rowOf(rows, 'period')?.cells[0]?.badge).toEqual({ kind: 'closes-in', days: 20 });
  });

  it('buildCompareView 는 항목과 행을 같은 순서로 함께 준다', () => {
    const view = buildCompareView([스무날, 오늘마감], TODAY);
    expect(view.items.map((i) => i.name)).toEqual(['오늘마감', '스무날']);
    // 머리글(view.items)과 칸(view.rows)의 n 번째가 같은 팝업을 가리켜야 한다.
    expect(rowOf(view.rows, 'period')?.cells[0]?.badge).toEqual({ kind: 'closing-today' });
    expect(rowOf(view.rows, 'period')?.cells[1]?.badge).toEqual({ kind: 'closes-in', days: 20 });
  });
});

describe('마이팝과 같은 순서를 낸다 — 이 정렬을 택한 이유', () => {
  /**
   * <b>이 시험이 ②(마감 임박순)를 고른 근거를 지킨다.</b> 후보를 고르는 곳이 마이팝이고 그 목록은
   * 이미 {@code groupSavedWishlist} 가 정렬해 둔다. 비교가 다른 규칙을 쓰면 같은 데이터가 두
   * 화면에서 다른 순서로 보인다 — 위에서 첫 번째였던 것이 비교에서는 가운데에 있게 된다.
   *
   * <p>그래서 두 함수의 결과를 직접 맞대어 본다. 한쪽 규칙만 바뀌면 여기서 빨간불이 난다.
   */
  const toWishlistItem = (it: CompareItem, i: number): WishlistItem => ({
    wishlistId: i,
    popupId: it.popupId,
    popupName: it.name,
    popupImage: '',
    location: it.location ?? '',
    startDate: it.openDate ?? '',
    endDate: it.closeDate ?? '',
  });

  it('갈 수 있는 것·예정·끝난 것을 이어 붙인 순서와 같다', () => {
    const items = [
      item({ popupId: 1, name: '끝남', openDate: '2026-08-01', closeDate: '2026-08-10' }),
      item({ popupId: 2, name: '곧열림', openDate: '2026-09-10', closeDate: '2026-09-20' }),
      item({ popupId: 3, name: '마감미정', openDate: '2026-09-01', closeDate: null }),
      item({ popupId: 4, name: '이틀', openDate: '2026-09-01', closeDate: '2026-09-09' }),
      item({ popupId: 5, name: '오늘마감', openDate: '2026-09-01', closeDate: '2026-09-07' }),
    ];

    const groups = groupSavedWishlist(items.map(toWishlistItem), TODAY);
    const myPopOrder = [...groups.current, ...groups.upcoming, ...groups.ended].map(
      (i) => i.popupName,
    );

    expect(orderCompareItems(items, TODAY).map((i) => i.name)).toEqual(myPopOrder);
  });
});
