import { describe, expect, it } from 'vitest';

import { MOODS, moodById } from '@/lib/moods';
import type { PopupStore } from '@/types/popup';
import { buildCourse, COURSE_SIZE, durationText } from './buildCourse';

const ORIGIN = { lat: 37.5445, lng: 127.0557 };

function popup(id: number, category: string, latOffset: number, coords = true): PopupStore {
  return {
    id,
    name: `팝업 ${id}`,
    location: '서울 성수동',
    status: 'ONGOING',
    viewCount: 0,
    category,
    latitude: coords ? String(ORIGIN.lat + latOffset) : undefined,
    longitude: coords ? String(ORIGIN.lng) : undefined,
  };
}

const chill = moodById('chill'); // FOOD, CULTURE
const cute = moodById('cute'); // CHARACTER

describe('buildCourse', () => {
  it('무드에 드는 분야만 담는다', () => {
    const course = buildCourse(
      [popup(1, 'FOOD', 0.002), popup(2, 'FASHION', 0.003), popup(3, 'CULTURE', 0.004)],
      chill,
      ORIGIN,
    );
    expect(course?.stops.map((s) => s.id)).toEqual([1, 3]);
  });

  /* 동선의 전부가 "어디서 어디까지 몇 분" 인데, 좌표가 없으면 그 질문에 답할 수 없다. */
  it('좌표가 없는 팝업은 뺀다', () => {
    const course = buildCourse(
      [popup(1, 'FOOD', 0.002, false), popup(2, 'FOOD', 0.004), popup(3, 'CULTURE', 0.006)],
      chill,
      ORIGIN,
    );
    expect(course?.stops.map((s) => s.id)).toEqual([2, 3]);
  });

  it('가까운 곳부터 순서를 짠다', () => {
    const course = buildCourse(
      [popup(1, 'FOOD', 0.012), popup(2, 'FOOD', 0.002), popup(3, 'CULTURE', 0.006)],
      chill,
      ORIGIN,
    );
    expect(course?.stops.map((s) => s.id)).toEqual([2, 3, 1]);
  });

  it('네 곳까지만 담는다', () => {
    const many = Array.from({ length: 9 }, (_, i) => popup(i + 1, 'FOOD', 0.002 * (i + 1)));
    expect(buildCourse(many, chill, ORIGIN)?.stops).toHaveLength(COURSE_SIZE);
  });

  /* 한 곳짜리 "코스" 는 코스가 아니다. */
  it('후보가 두 곳도 안 되면 코스를 만들지 않는다', () => {
    expect(buildCourse([popup(1, 'FOOD', 0.002)], chill, ORIGIN)).toBeNull();
    expect(buildCourse([], chill, ORIGIN)).toBeNull();
    expect(buildCourse([popup(1, 'FOOD', 0.002), popup(2, 'FOOD', 0.004)], cute, ORIGIN)).toBeNull();
  });

  it('걷는 시간과 총 소요를 함께 센다', () => {
    const course = buildCourse([popup(1, 'FOOD', 0.002), popup(2, 'CULTURE', 0.006)], chill, ORIGIN);
    expect(course).not.toBeNull();
    expect(course!.walkMinutes).toBeGreaterThan(0);
    /* 총 소요는 걷는 시간 + 곳마다의 체류라 언제나 더 크다. */
    expect(course!.totalMinutes).toBeGreaterThan(course!.walkMinutes);
  });

  it.each(MOODS)('$label 무드도 같은 규칙으로 돈다', (mood) => {
    const pool = ['FOOD', 'CULTURE', 'FASHION', 'BEAUTY', 'CHARACTER', 'TECH'].flatMap((cat, i) => [
      popup(100 + i * 2, cat, 0.002 * (i + 1)),
      popup(101 + i * 2, cat, 0.003 * (i + 1)),
    ]);
    const course = buildCourse(pool, mood, ORIGIN);
    expect(course).not.toBeNull();
    for (const stop of course!.stops) {
      expect(mood.cats).toContain(stop.popup.category);
    }
  });
});

describe('durationText', () => {
  it('한 시간이 안 되면 분만 말한다', () => {
    expect(durationText(42)).toBe('42분');
  });

  it('시간과 분으로 나눈다', () => {
    expect(durationText(200)).toBe('3시간 20분');
    expect(durationText(120)).toBe('2시간');
  });
});
