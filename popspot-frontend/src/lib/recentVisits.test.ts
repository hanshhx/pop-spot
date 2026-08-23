// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { readVisits, recordVisit } from './recentVisits';

/**
 * 최근 본 팝업 기록.
 *
 * <p>이 모듈은 홈 카드와 일정 탭의 '내가 본 팝업' 이 함께 읽는 유일한 출처인데, 그동안 테스트가
 * 하나도 없었다. 2026-08-23 에 "상세를 눌러도 최근 본 팝업이 안 는다" 는 제보가 왔을 때 기록이
 * 끊긴 줄 알고 이 경로부터 뒤졌다 — 실제 원인은 화면이 <b>자른 뒤의 길이</b>를 개수로 적고 있던
 * 것이었고, 저장은 처음부터 멀쩡했다. 그때 이 파일이 있었다면 절반은 바로 지워냈을 조사다.
 *
 * <p>상한을 서른으로 올리면서 함께 둔다. 상한·순서·중복 제거는 눈으로 볼 수 없고, 넘치기
 * 시작하는 서른한 번째부터야 드러난다.
 */
const KEY = 'popspot:recent-visits';

const visit = (popupId: number) => ({ popupId, popupName: `팝업 ${popupId}` });

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
    expect(readVisits().map((v) => v.popupId)).toEqual([3, 2, 1]);
  });

  it('같은 팝업을 다시 보면 늘지 않고 맨 앞으로 올라온다', () => {
    recordVisit(visit(1));
    recordVisit(visit(2));
    recordVisit(visit(1));
    expect(readVisits().map((v) => v.popupId)).toEqual([1, 2]);
  });

  it('서른 개를 넘기면 가장 오래된 것부터 밀려난다', () => {
    for (let id = 1; id <= 31; id += 1) recordVisit(visit(id));
    const ids = readVisits().map((v) => v.popupId);
    expect(ids).toHaveLength(30);
    expect(ids[0]).toBe(31);
    // 첫 번째로 본 1번이 밀려난 자리에 2번이 마지막으로 남는다.
    expect(ids.at(-1)).toBe(2);
    expect(ids).not.toContain(1);
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
