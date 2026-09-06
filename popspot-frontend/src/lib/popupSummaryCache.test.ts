// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  POPUP_SUMMARY_CACHE_KEY,
  type PopupSummary,
  clearSummaries,
  readSummaries,
  rememberSummaries,
  resolveSummary,
  toSummary,
} from './popupSummaryCache';
import type { PopupStore } from '@/types/popup';

/**
 * <b>이 캐시가 하는 일은 요청을 안 하는 것이다.</b>
 *
 * <p>저장 목록이 끝난 팝업의 이름을 알아내려고 부르는 {@code GET /api/popups/{id}} 는 읽기가
 * 아니라 쓰기다 — 조회수를 올리고 YouTube 검색을 한 번 태운다. 여기 적어 둔 것이 다음 방문에서
 * 읽히지 않으면 그 대가를 매번 다시 치른다. 그래서 이 파일의 시험은 대부분 "적은 것을 다시
 * 읽는가" 이다.
 */

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60_000;

const popup = (id: number, over: Partial<PopupStore> = {}): PopupStore =>
  ({ id, name: `팝업 ${id}`, imageUrl: 'x.jpg', location: '서울', ...over }) as PopupStore;

beforeEach(() => {
  window.localStorage.clear();
});

describe('적고 읽기', () => {
  it('적은 것을 다시 읽는다 — 이게 안 되면 요청이 매번 다시 나간다', () => {
    rememberSummaries(
      [toSummary(popup(7, { startDate: '2024-01-01', endDate: '2024-02-01' }), NOW)],
      NOW,
    );
    const got = readSummaries(NOW).get(7);
    expect(got?.name).toBe('팝업 7');
    expect(got?.endDate).toBe('2024-02-01');
  });

  it('여러 번 적어도 합쳐진다', () => {
    rememberSummaries([toSummary(popup(1), NOW)], NOW);
    rememberSummaries([toSummary(popup(2), NOW)], NOW);
    expect([...readSummaries(NOW).keys()].sort()).toEqual([1, 2]);
  });

  it('같은 id 를 다시 적으면 갈아 끼운다', () => {
    rememberSummaries([toSummary(popup(3, { name: '옛 이름' }), NOW)], NOW);
    rememberSummaries([toSummary(popup(3, { name: '고친 이름' }), NOW + 1000)], NOW + 1000);
    expect(readSummaries(NOW + 1000).get(3)?.name).toBe('고친 이름');
  });

  it('빈 배열을 적으면 아무 일도 없다', () => {
    rememberSummaries([], NOW);
    expect(window.localStorage.getItem(POPUP_SUMMARY_CACHE_KEY)).toBeNull();
  });

  it('없는 값은 빈 문자열로 — 화면이 undefined 를 그리지 않게', () => {
    const s = toSummary({ id: 9, name: '이름만' } as PopupStore, NOW);
    expect(s).toEqual({
      id: 9,
      name: '이름만',
      imageUrl: '',
      location: '',
      startDate: '',
      endDate: '',
      savedAt: NOW,
    });
  });

  it('버리면 없어진다', () => {
    rememberSummaries([toSummary(popup(1), NOW)], NOW);
    clearSummaries();
    expect(readSummaries(NOW).size).toBe(0);
  });
});

describe('믿을 수 없는 값', () => {
  it.each([
    ['null', null],
    ['문자열', 'nope'],
    ['id 없음', { name: '이름', savedAt: NOW }],
    ['id 가 0', { id: 0, name: '이름', savedAt: NOW }],
    ['id 가 문자열', { id: '3', name: '이름', savedAt: NOW }],
    ['이름 없음', { id: 3, savedAt: NOW }],
    ['이름이 빈 문자열', { id: 3, name: '', savedAt: NOW }],
  ])('%s 은 거절한다', (_name, raw) => {
    expect(resolveSummary(raw, NOW)).toBeNull();
  });

  /*
   * 끝난 팝업의 이름은 변하지 않으므로 사실 만료가 필요 없다. 그래도 두는 이유는 크롤러가 잘못
   * 넣은 이름·좌표가 나중에 고쳐지는 일이 실제로 있기 때문이다.
   */
  it('30일이 지나면 거절한다 — 고쳐진 자료를 언젠가는 다시 읽는다', () => {
    expect(resolveSummary({ id: 3, name: '이름', savedAt: NOW - 31 * DAY }, NOW)).toBeNull();
  });

  it('29일은 아직 통과한다', () => {
    expect(resolveSummary({ id: 3, name: '이름', savedAt: NOW - 29 * DAY }, NOW)?.id).toBe(3);
  });

  it('미래에 적힌 값은 거절한다 — 수명 검사를 무한정 통과한다', () => {
    expect(resolveSummary({ id: 3, name: '이름', savedAt: NOW + 1000 }, NOW)).toBeNull();
  });

  it('저장소에 쓰레기가 들어 있어도 던지지 않는다', () => {
    window.localStorage.setItem(POPUP_SUMMARY_CACHE_KEY, '{not json');
    expect(readSummaries(NOW).size).toBe(0);
  });

  it('배열이 아니면 빈 것으로 본다', () => {
    window.localStorage.setItem(POPUP_SUMMARY_CACHE_KEY, '{"a":1}');
    expect(readSummaries(NOW).size).toBe(0);
  });

  it('낡은 항목만 골라 버리고 나머지는 남긴다', () => {
    const old: PopupSummary = { ...toSummary(popup(1), NOW), savedAt: NOW - 40 * DAY };
    window.localStorage.setItem(
      POPUP_SUMMARY_CACHE_KEY,
      JSON.stringify([old, toSummary(popup(2), NOW)]),
    );
    expect([...readSummaries(NOW).keys()]).toEqual([2]);
  });
});

describe('상한', () => {
  /* 비회원 찜 상한과 같은 100. 넘으면 오래된 것부터 버린다 — 최근 것일수록 지금 화면에 있다. */
  it('100개를 넘으면 오래된 것부터 버린다', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      ...toSummary(popup(i + 1), NOW),
      savedAt: NOW - (120 - i) * 1000,
    }));
    rememberSummaries(many, NOW);
    const kept = readSummaries(NOW);
    expect(kept.size).toBe(100);
    expect(kept.has(1)).toBe(false); // 가장 오래된 것
    expect(kept.has(120)).toBe(true); // 가장 최근 것
  });
});
