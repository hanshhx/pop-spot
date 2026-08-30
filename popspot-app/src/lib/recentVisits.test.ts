import { describe, expect, it } from 'vitest';

import {
  SAFETY_LIMIT,
  nextVisits,
  sanitize,
  withoutVisit,
  type RecentVisit,
} from './recentVisits';

/**
 * 방문 기록의 규칙.
 *
 * <p>웹은 같은 규칙을 jsdom + localStorage 로 검증한다. 앱에는 둘 다 없으므로 규칙만 떼어 낸
 * 순수 함수를 검증한다 — 확인하는 것은 같다: 무엇이 앞으로 오는가, 무엇이 사라지는가, 망가진
 * 기록을 만나면 어떻게 되는가.
 */

const visit = (popupId: number, visitedAt = '2026-08-30T00:00:00.000Z'): RecentVisit => ({
  popupId,
  popupName: `팝업 ${popupId}`,
  visitedAt,
});

describe('nextVisits', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');

  it('새로 본 팝업이 맨 앞에 온다', () => {
    const out = nextVisits([visit(1), visit(2)], { popupId: 3, popupName: '팝업 3' }, now);
    expect(out.map((v) => v.popupId)).toEqual([3, 1, 2]);
    expect(out[0].visitedAt).toBe(now.toISOString());
  });

  it('이미 본 팝업을 다시 보면 개수는 그대로고 맨 앞으로만 온다', () => {
    const out = nextVisits(
      [visit(1), visit(2), visit(3)],
      { popupId: 3, popupName: '팝업 3' },
      now,
    );
    expect(out.map((v) => v.popupId)).toEqual([3, 1, 2]);
    expect(out).toHaveLength(3);
  });

  it('다시 본 시각으로 갱신된다 — 마지막으로 언제 봤는지가 화면에 필요한 정보다', () => {
    const out = nextVisits([visit(1, '2020-01-01T00:00:00.000Z')], { popupId: 1, popupName: 'x' }, now);
    expect(out[0].visitedAt).toBe(now.toISOString());
  });

  it('오래됐다는 이유로 흘려보내지 않는다 — 안전장치까지는 전부 쌓인다', () => {
    let list: RecentVisit[] = [];
    for (let i = 0; i < 40; i += 1) {
      list = nextVisits(list, { popupId: i, popupName: `p${i}` }, now);
    }
    // 예전 앱 구현은 20개에서 잘랐다. 웹은 사람이 지우기 전까지 남긴다.
    expect(list).toHaveLength(40);
  });

  it('안전장치를 넘기면 가장 오래된 것부터 잘린다', () => {
    let list: RecentVisit[] = [];
    for (let i = 0; i < SAFETY_LIMIT + 5; i += 1) {
      list = nextVisits(list, { popupId: i, popupName: `p${i}` }, now);
    }
    expect(list).toHaveLength(SAFETY_LIMIT);
    // 방금 본 것이 살아남고, 맨 처음 본 것이 사라진다.
    expect(list[0].popupId).toBe(SAFETY_LIMIT + 4);
    expect(list.some((v) => v.popupId === 0)).toBe(false);
  });

  it('원본 목록을 고치지 않는다', () => {
    const list = [visit(1)];
    nextVisits(list, { popupId: 2, popupName: 'x' }, now);
    expect(list).toHaveLength(1);
  });
});

describe('withoutVisit', () => {
  it('지정한 것만 빼고 순서를 그대로 둔다', () => {
    const out = withoutVisit([visit(1), visit(2), visit(3)], 2);
    expect(out.map((v) => v.popupId)).toEqual([1, 3]);
  });

  it('없는 id 면 길이가 그대로다 — 부르는 쪽이 이걸 보고 저장을 건너뛴다', () => {
    const list = [visit(1), visit(2)];
    expect(withoutVisit(list, 99)).toHaveLength(list.length);
  });
});

describe('sanitize', () => {
  it('배열이 아니면 빈 목록', () => {
    expect(sanitize(null)).toEqual([]);
    expect(sanitize({ popupId: 1 })).toEqual([]);
    expect(sanitize('[]')).toEqual([]);
  });

  it('popupId 가 숫자 문자열인 옛 형식도 읽는다', () => {
    // 거부하면 방문 이력이 조용히 사라진다 — 사용자가 다시 만들 수 없는 것이다.
    expect(sanitize([{ popupId: '7', popupName: 'a', visitedAt: 'x' }])[0].popupId).toBe(7);
  });

  it('id 를 읽을 수 없는 항목만 버리고 나머지는 남긴다', () => {
    const out = sanitize([
      { popupId: 'abc', popupName: 'bad' },
      { popupId: 5, popupName: 'good', visitedAt: 'x' },
      null,
    ]);
    expect(out.map((v) => v.popupId)).toEqual([5]);
  });

  it('이름·시각이 없어도 항목을 버리지 않는다', () => {
    const out = sanitize([{ popupId: 3 }]);
    expect(out).toEqual([{ popupId: 3, popupName: '', popupImage: undefined, visitedAt: '' }]);
  });

  it('안전장치 길이까지만 읽는다', () => {
    const raw = Array.from({ length: SAFETY_LIMIT + 10 }, (_, i) => ({
      popupId: i,
      popupName: '',
      visitedAt: '',
    }));
    expect(sanitize(raw)).toHaveLength(SAFETY_LIMIT);
  });
});
