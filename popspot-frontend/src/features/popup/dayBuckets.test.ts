import { describe, expect, it } from 'vitest';

import { bucketByDay, closingCountsByDate } from './dayBuckets';
import type { PopupStore } from '@/types/popup';

/**
 * 달력에서 하루가 뜻하는 것.
 *
 * <p>예전 달력은 날짜를 누르면 그날 <b>진행 중인</b> 팝업을 전부 보여줬다. 실측으로 8월 23일에
 * 508곳이었고, 팝업은 몇 주씩 하니 다음 날을 눌러도 비슷한 500곳이었다 — 날짜를 고르는 의미가
 * 없으면 그건 달력이 아니라 목록이다. 날짜마다 실제로 달라지는 것은 그날 열리고 닫히는 것이다
 * (같은 사흘에 59 · 22 · 153).
 *
 * <p>아래 표본은 손으로 만든 것이다. 살아 있는 데이터로 세면 내일 팝업 하나가 끝나는 순간
 * 빨개지는데, 그건 회귀가 아니라 세상이 변한 것이다.
 */
const p = (o: Partial<PopupStore> & { id: number; name: string }): PopupStore => ({
  location: '서울 성동구 성수동',
  status: '보통',
  viewCount: 0,
  ...o,
});

const DAY = '2026-08-31';

describe('bucketByDay', () => {
  it('그날 끝나는 것은 마감이고, 그날 시작하는 것은 오픈이다', () => {
    const list = [
      p({
        id: 1,
        name: '오늘 닫는 팝업',
        startDate: '2026-08-01',
        endDate: DAY,
      }),
      p({
        id: 2,
        name: '오늘 여는 팝업',
        startDate: DAY,
        endDate: '2026-09-15',
      }),
    ];
    const got = bucketByDay(list, DAY);
    expect(got.closing.map((x) => x.id)).toEqual([1]);
    expect(got.opening.map((x) => x.id)).toEqual([2]);
  });

  it('하루짜리 팝업은 오픈과 마감 양쪽에 든다 — 그날 열고 그날 닫는 것이 사실이다', () => {
    const list = [p({ id: 3, name: '하루 팝업', startDate: DAY, endDate: DAY })];
    const got = bucketByDay(list, DAY);
    expect(got.closing.map((x) => x.id)).toEqual([3]);
    expect(got.opening.map((x) => x.id)).toEqual([3]);
    expect(got.runningCount).toBe(1);
  });

  it('종료일만 있고 시작일이 없어도 마감에는 든다 — 예전 달력은 이런 팝업을 어느 날짜에도 안 보여줬다', () => {
    const list = [p({ id: 4, name: '시작일 미상', endDate: DAY })];
    const got = bucketByDay(list, DAY);
    expect(got.closing.map((x) => x.id)).toEqual([4]);
    expect(got.opening).toHaveLength(0);
    expect(got.runningCount).toBe(0);
  });

  it('종료일이 없으면 시작일을 끝으로 본다', () => {
    const list = [p({ id: 5, name: '종료일 미상', startDate: DAY })];
    const got = bucketByDay(list, DAY);
    expect(got.closing.map((x) => x.id)).toEqual([5]);
    expect(got.runningCount).toBe(1);
  });

  it('기간이 그날을 감싸면 진행 중으로 센다 — 마감·오픈에는 안 든다', () => {
    const list = [
      p({
        id: 6,
        name: '진행 중',
        startDate: '2026-08-01',
        endDate: '2026-09-30',
      }),
    ];
    const got = bucketByDay(list, DAY);
    expect(got.runningCount).toBe(1);
    expect(got.closing).toHaveLength(0);
    expect(got.opening).toHaveLength(0);
  });

  it('날짜가 아예 없는 항목은 어디에도 안 든다', () => {
    const got = bucketByDay([p({ id: 7, name: '날짜 없음' })], DAY);
    expect(got.closing).toHaveLength(0);
    expect(got.opening).toHaveLength(0);
    expect(got.runningCount).toBe(0);
  });

  it('진행 중 판정은 예전 getPopupsForDate 와 같은 답을 낸다', () => {
    // 예전 구현을 그대로 옮겨 온 것 — 이 줄이 회귀 감시선이다.
    const legacy = (list: PopupStore[], date: string) =>
      list.filter((x) => {
        if (!x.startDate) return false;
        const end = x.endDate || x.startDate;
        return date >= x.startDate && date <= end;
      });
    const list = [
      p({ id: 1, name: 'a', startDate: '2026-08-01', endDate: '2026-09-30' }),
      p({ id: 2, name: 'b', startDate: DAY, endDate: DAY }),
      p({ id: 3, name: 'c', endDate: DAY }),
      p({ id: 4, name: 'd', startDate: '2026-09-01' }),
      p({ id: 5, name: 'e' }),
    ];
    expect(bucketByDay(list, DAY).runningCount).toBe(legacy(list, DAY).length);
  });

  it('종료일이 빈 문자열이면 없는 것으로 본다 — ?? 로 바꾸면 이 팝업이 모든 덩어리에서 사라진다', () => {
    const list = [
      p({
        id: 8,
        name: '종료일 빈 문자열',
        startDate: DAY,
        endDate: '',
      }),
    ];
    const got = bucketByDay(list, DAY);
    expect(got.closing.map((x) => x.id)).toEqual([8]);
    expect(got.opening.map((x) => x.id)).toEqual([8]);
    expect(got.runningCount).toBe(1);
  });
});

describe('closingCountsByDate', () => {
  it('마감일마다 몇 곳이 닫히는지 센다', () => {
    const counts = closingCountsByDate([
      p({ id: 1, name: 'a', startDate: '2026-08-01', endDate: DAY }),
      p({ id: 2, name: 'b', startDate: '2026-08-02', endDate: DAY }),
      p({ id: 3, name: 'c', startDate: '2026-08-03', endDate: '2026-09-05' }),
    ]);
    expect(counts.get(DAY)).toBe(2);
    expect(counts.get('2026-09-05')).toBe(1);
  });

  it('마감이 없는 날은 키가 아예 없다 — 0 이 아니다', () => {
    const counts = closingCountsByDate([p({ id: 1, name: 'a', endDate: DAY })]);
    expect(counts.has('2026-08-30')).toBe(false);
    expect(counts.get('2026-08-30')).toBeUndefined();
  });

  it('날짜를 하나도 모르는 항목은 세지 않는다', () => {
    expect(closingCountsByDate([p({ id: 1, name: '날짜 없음' })]).size).toBe(0);
  });

  it('종료일이 빈 문자열이면 시작일을 마감일로 센다', () => {
    const counts = closingCountsByDate([
      p({
        id: 9,
        name: '종료일 빈 문자열',
        startDate: DAY,
        endDate: '',
      }),
    ]);
    expect(counts.get(DAY)).toBe(1);
  });
});
