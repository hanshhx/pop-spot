import { describe, expect, it } from 'vitest';

import { getPeriods, isOpenNow, isStale, periodBySlug } from '@/lib/popupSlices';

/**
 * 시점 라벨이 **부르는 시점의 날짜를 따라가는지** 확인한다.
 *
 * 예전에는 `export const PERIODS = getPeriods()` 라는 모듈 최상위 상수가 있었다. 모듈이 처음
 * 읽힐 때 한 번만 계산되므로 `이번 주 (7/20~7/26)` 같은 날짜가 라벨에 박힌 채 남았다. 반면
 * 목록을 거르는 `matchesPeriod` 는 부를 때마다 현재 시각을 새로 읽는다. 결과적으로
 * **제목은 지난주인데 목록은 이번주**인 상태가 만들어졌다.
 *
 * 이 결함은 **주가 바뀌어야만 드러나고** 화면에는 오류가 아니라 그럴듯한 옛 날짜로 보인다.
 * 사람이 알아채기 전에 검색엔진이 먼저 그 제목을 가져간다. 그래서 시각을 넣어 고정한다.
 *
 * KST 기준이라 시각은 UTC 로 만든다 — 테스트 도는 기계의 시간대에 결과가 흔들리면 안 된다.
 */

/** KST 2026-07-29(수) 낮 12시. */
const WED_JUL_29 = new Date(Date.UTC(2026, 6, 29, 3, 0));

/** 그 일주일 전 — KST 2026-07-22(수). */
const WED_JUL_22 = new Date(Date.UTC(2026, 6, 22, 3, 0));

describe('시점 라벨은 부르는 시점을 따라간다', () => {
  it('주가 바뀌면 "이번 주" 라벨도 바뀐다 — 굳어 있으면 여기서 걸린다', () => {
    const before = periodBySlug('this-week', WED_JUL_22);
    const after = periodBySlug('this-week', WED_JUL_29);

    expect(before?.label).toBe('이번 주 (7/20~7/26)');
    expect(after?.label).toBe('이번 주 (7/27~8/2)');
  });

  it('오늘·내일 라벨에 그날 날짜가 들어간다', () => {
    expect(periodBySlug('today', WED_JUL_29)?.label).toBe('오늘 (7/29 수)');
    expect(periodBySlug('tomorrow', WED_JUL_29)?.label).toBe('내일 (7/30 목)');
  });

  it('주말은 다가오는 토요일을 가리킨다', () => {
    expect(periodBySlug('this-weekend', WED_JUL_29)?.label).toBe('이번 주말 (8/1)');
  });

  it('일요일에는 "다음 주말" 이 된다 — 이미 지난 주말을 가리키지 않는다', () => {
    // KST 2026-08-02(일).
    const sunday = new Date(Date.UTC(2026, 7, 2, 3, 0));

    expect(periodBySlug('this-weekend', sunday)?.label).toBe('다음 주말 (8/8)');
  });

  it('달이 바뀌면 "이번 달" 도 바뀐다', () => {
    expect(periodBySlug('this-month', WED_JUL_29)?.label).toBe('7월');
    expect(periodBySlug('this-month', new Date(Date.UTC(2026, 7, 2, 3, 0)))?.label).toBe('8월');
  });

  it('영어·일본어 라벨도 같이 따라간다 — 한국어만 고치면 반쪽이다', () => {
    const en = periodBySlug('this-week', WED_JUL_29);

    expect(en?.labelEn).toBe('This week (Jul 27–Aug 2)');
    expect(en?.labelJa).toBe('今週 (7/27〜8/2)');
  });

  it('슬러그는 날짜와 무관하게 항상 같다 — 주소가 흔들리면 색인이 깨진다', () => {
    const before = getPeriods(WED_JUL_22).map((p) => p.slug);
    const after = getPeriods(WED_JUL_29).map((p) => p.slug);

    expect(before).toEqual(after);
    expect(before).toEqual(['today', 'tomorrow', 'this-week', 'this-weekend', 'this-month']);
  });
});

describe('종료일 없는 팝업의 90일 규칙', () => {
  const TODAY = new Date(2026, 7, 2); // 2026-08-02

  it('종료일이 있으면 이 규칙을 쓰지 않는다 — 종료일이 언제나 정답', () => {
    // 시작한 지 3년 지났어도 종료일이 미래면 진행 중이다(장기 운영 매장).
    expect(isStale('2023-01-01', '2027-01-01', TODAY)).toBe(false);
  });

  it('종료일이 없고 시작한 지 90일이 넘으면 끝난 것으로 본다', () => {
    expect(isStale('2017-07-07', null, TODAY)).toBe(true);
    expect(isStale('2026-01-01', null, TODAY)).toBe(true);
  });

  it('90일이 안 지났으면 남긴다 — 진행 중일 수 있다', () => {
    expect(isStale('2026-07-20', null, TODAY)).toBe(false);
    expect(isStale('2026-08-10', null, TODAY)).toBe(false); // 아직 시작 전
  });

  it('경계 — 정확히 90일째는 아직 남긴다', () => {
    const d90 = new Date(TODAY);
    d90.setDate(d90.getDate() - 90);
    const iso = `${d90.getFullYear()}-${d90.getMonth() + 1}-${d90.getDate()}`;

    expect(isStale(iso, null, TODAY)).toBe(false);
  });

  it('시작일도 없으면 판단하지 않는다 — 수집 시각이 있어야 잴 수 있다', () => {
    // 여기서 true 를 돌려주면 날짜 없는 541건이 한꺼번에 사라진다. 근거 없이 지우지 않는다.
    expect(isStale(null, null, TODAY)).toBe(false);
    expect(isStale('', '', TODAY)).toBe(false);
  });

  it('isOpenNow 도 같은 기준을 쓴다 — 화면마다 갈리면 안 된다', () => {
    expect(isOpenNow('2017-07-07', null, TODAY)).toBe(false);
  });
});
