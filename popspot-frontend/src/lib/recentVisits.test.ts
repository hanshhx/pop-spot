// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearVisits, readVisits, recordVisit, removeVisit } from './recentVisits';

/**
 * 최근 본 팝업 기록.
 *
 * <p>이 모듈은 홈 카드와 일정 탭의 '내가 본 팝업' 이 함께 읽는 유일한 출처인데, 그동안 테스트가
 * 하나도 없었다. 2026-08-23 에 "상세를 눌러도 최근 본 팝업이 안 는다" 는 제보가 왔을 때 기록이
 * 끊긴 줄 알고 이 경로부터 뒤졌다 — 실제 원인은 화면이 <b>자른 뒤의 길이</b>를 개수로 적고 있던
 * 것이었고, 저장은 처음부터 멀쩡했다. 그때 이 파일이 있었다면 절반은 바로 지워냈을 조사다.
 *
 * <p>이제는 기록이 서른에서 밀려나지 않고 쌓인다. 쌓인다는 말은 <b>지우는 길과 넘칠 때의 길</b>이
 * 함께 있어야 한다는 뜻이고, 셋 다 눈으로 볼 수 없는 규칙이다. 서른한 번째에서 한 번, 오백 번째에서
 * 한 번, 그리고 저장소가 튕길 때 한 번 — 사람이 만나기 전에 여기서 먼저 만난다.
 */
const KEY = 'popspot:recent-visits';

const visit = (popupId: number) => ({ popupId, popupName: `팝업 ${popupId}` });

/** 심어 둔 기록의 본 시각. 고정값이다 — {@code new Date()} 는 KST 인 이 기계와 UTC 인 CI 를 갈라 놓는다. */
const SEEDED_AT = '2026-08-23T00:00:00.000Z';

/**
 * 최신순 id 목록을 통째로 심는다.
 *
 * <p>상한을 확인하려고 {@code recordVisit} 을 오백 번 부르면 느리기만 하다. 저장 형식은 이
 * 모듈이 정한 것이고 심은 값은 {@code readVisits} 를 그대로 통과하므로, 가장자리에 서는 방법으로
 * 공평하다.
 */
const seed = (ids: number[]) => {
  window.localStorage.setItem(
    KEY,
    JSON.stringify(ids.map((popupId) => ({ ...visit(popupId), visitedAt: SEEDED_AT }))),
  );
};

const idsOf = () => readVisits().map((v) => v.popupId);

/**
 * 남기고 읽는 쪽.
 *
 * <p>순서·중복 제거는 예전부터 있던 약속이고, 여기에 "밀려나지 않는다" 가 새로 들어왔다. 둘은
 * 같은 배열을 두고 반대 방향으로 당기므로 — 앞으로 올리는 규칙과 뒤를 자르지 않는 규칙 — 한
 * 곳에서 함께 본다.
 */
describe('recordVisit / readVisits', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('본 적이 없으면 빈 목록이다', () => {
    expect(readVisits()).toEqual([]);
  });

  it('가장 최근에 본 것이 맨 앞에 온다', () => {
    recordVisit(visit(1));
    recordVisit(visit(2));
    recordVisit(visit(3));
    expect(idsOf()).toEqual([3, 2, 1]);
  });

  it('같은 팝업을 다시 보면 늘지 않고 맨 앞으로 올라온다', () => {
    recordVisit(visit(1));
    recordVisit(visit(2));
    recordVisit(visit(1));
    expect(idsOf()).toEqual([1, 2]);
  });

  it('서른한 번째를 봐도 맨 처음 본 것이 그대로 남는다 — 더 이상 서른에서 밀려나지 않는다', () => {
    for (let id = 1; id <= 31; id += 1) recordVisit(visit(id));
    const ids = idsOf();
    expect(ids).toHaveLength(31);
    expect(ids[0]).toBe(31);
    // 예전 상한이라면 여기서 사라졌을 첫 기록이다.
    expect(ids.at(-1)).toBe(1);
  });

  it('오백에서는 멈춘다 — 제품이 정한 개수가 아니라 저장소 벽 앞의 안전장치다', () => {
    // 오백 개를 한 번에 심고 한 번만 더 본다. 하나씩 오백한 번 부르는 것과 서는 자리가 같다.
    seed(Array.from({ length: 500 }, (_, index) => index + 1));
    recordVisit(visit(9999));
    const ids = idsOf();
    expect(ids).toHaveLength(500);
    expect(ids[0]).toBe(9999);
    // 가장 오래된 500 번이 새 기록에 밀려 떨어진 자리에 499 번이 마지막으로 남는다.
    expect(ids.at(-1)).toBe(499);
    expect(ids).not.toContain(500);
  });

  it('본 시각을 함께 남긴다 — 화면이 최신순을 이 값으로 따진다', () => {
    recordVisit(visit(7));
    const [saved] = readVisits();
    expect(saved).toMatchObject({ popupId: 7, popupName: '팝업 7' });
    expect(Number.isNaN(Date.parse(saved.visitedAt))).toBe(false);
  });

  it('저장소에 엉뚱한 것이 들어 있어도 터지지 않고 빈 목록을 준다', () => {
    window.localStorage.setItem(KEY, 'not json');
    expect(readVisits()).toEqual([]);
    window.localStorage.setItem(KEY, '{"popupId":1}');
    expect(readVisits()).toEqual([]);
  });
});

/**
 * 지우는 쪽.
 *
 * <p>기록이 쌓이기만 하는 순간부터 지우기는 곁다리가 아니라 짝이다. 하나만 빼는 길이 없으면
 * 거슬리는 한 줄 때문에 전부를 버리게 되고, 그러면 "남긴다" 는 결정 자체가 무의미해진다.
 *
 * <p>순서를 함께 보는 이유가 있다. 지우기를 '거르고 다시 쓰기' 로 구현하는 이상 남은 것들의
 * 자리가 흔들릴 여지가 늘 있고, 그렇게 되면 목록이 지운 직후에만 최신순이 아니게 된다.
 */
describe('removeVisit / clearVisits', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('지목한 기록 하나만 빠지고 나머지 순서는 그대로다', () => {
    seed([5, 4, 3, 2, 1]);
    removeVisit(3);
    expect(idsOf()).toEqual([5, 4, 2, 1]);
  });

  it('없는 id 를 지우라고 하면 아무것도 달라지지 않는다', () => {
    seed([5, 4, 3]);
    removeVisit(99);
    expect(idsOf()).toEqual([5, 4, 3]);
  });

  it('clearVisits 는 목록을 통째로 비운다', () => {
    seed([5, 4, 3]);
    clearVisits();
    expect(readVisits()).toEqual([]);
  });
});

/**
 * 저장소가 말썽일 때.
 *
 * <p>서른 개를 넘길 일이 없던 시절에는 {@code setItem} 이 던지는 일도 없었고, 그래서 예외를
 * 삼키는 빈 {@code catch} 가 값을 치르지 않았다. 기록을 계속 쌓기로 한 지금은 다르다. 할당량이
 * 찬 순간부터 <b>앞으로 보는 모든 팝업이</b> 저장되지 않는데 사용자에게는 아무 신호도 가지 않는다.
 *
 * <p>그래서 여기서 정하는 것은 "넘치면 무엇을 잃는가" 다. 지난 기록의 절반을 잃는 쪽이, 앞으로의
 * 기록을 전부 잃는 쪽보다 낫다.
 */
describe('저장이 튕길 때의 recordVisit / clearVisits', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('한 번 튕기면 오래된 절반을 버리고 다시 넣는다 — 값을 치르는 것은 지난 기록이지 앞으로의 기록이 아니다', () => {
    seed([40, 30, 20, 10]);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    recordVisit(visit(50));

    expect(setItem).toHaveBeenCalledTimes(2);
    // 방금 본 50 번과 최근 절반만 남는다. 재시도가 새 기록을 버리는 일은 없어야 한다.
    expect(idsOf()).toEqual([50, 40, 30]);
  });

  it('두 번째도 튕기면 조용히 포기한다 — 저장소가 막혀도 상세 화면은 살아 있어야 한다', () => {
    seed([40, 30, 20, 10]);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => recordVisit(visit(50))).not.toThrow();

    expect(setItem).toHaveBeenCalledTimes(2);
    expect(idsOf()).toEqual([40, 30, 20, 10]);
  });

  it('clearVisits 는 removeItem 이 던져도 삼킨다 — 삭제 버튼이 이 함수의 첫 호출자다', () => {
    seed([5, 4, 3]);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => clearVisits()).not.toThrow();
  });
});
