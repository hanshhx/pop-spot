import { describe, expect, it } from 'vitest';

import { visitedAgo } from './visitedAgo';

/**
 * 최근 본 팝업의 "언제 봤는지".
 *
 * <p>여기서 지키는 것은 문구가 아니라 <b>날의 경계</b>다. 방문 기록은 날짜가 아니라 ISO
 * 타임스탬프로 남으므로, 두 시각을 그냥 빼면 어젯밤 23:50 에 본 것이 오늘 00:10 에 '오늘' 이
 * 된다 — 20분 차이니까 산수로는 맞다. 사용자에게는 틀린 답이다. 그 한 줄을 지키려고 이 파일이
 * 있고, 아래 시험 중 절반이 그 경계 하나를 여러 방향에서 민다.
 *
 * <p>모양만 돌려주는 것도 함께 못 박는다. 카드가 세 언어로 그려지는데 여기서 '3일 전' 을
 * 만들어 버리면 나머지 두 언어는 고칠 자리가 없다.
 *
 * <p>픽스처와 기준 시각을 <b>둘 다 로컬 시간 부품</b>으로 짓는다({@code new Date(년, 월, 일, 시,
 * 분)}). 러너가 KST 든 UTC 든 두 값이 같은 만큼 함께 밀리므로 '달력에서 며칠 차이인가' 는 어느
 * 시간대에서도 같다. 반대로 픽스처만 'Z' 가 붙은 문자열로 손수 적어 두면 기준 시각과 따로 놀아
 * UTC 러너에서만 하루가 밀린다 — 그래서 이 파일에는 ISO 문자열 리터럴이 하나도 없다.
 */
/** 2026년 8월 어느 날 어느 시각의 방문 기록. 로컬 시간으로 지어 ISO 로 굳힌다. */
const at = (day: number, hour: number, minute: number): string =>
  new Date(2026, 7, day, hour, minute).toISOString();

/** 2026년 8월 23일 오후 2시 30분. 자정에서 멀리 떨어뜨려 둔다 — 경계는 따로 시험한다. */
const NOW = new Date(2026, 7, 23, 14, 30);

/** 같은 날의 끝. 00:05 에 본 기록과 하루 끝과 끝만큼 떨어져 있다. */
const TONIGHT = new Date(2026, 7, 23, 23, 55);

/** 자정을 갓 넘긴 시각. 전날 23:50 과는 20분 차이지만 날은 이미 바뀌었다. */
const JUST_PAST_MIDNIGHT = new Date(2026, 7, 23, 0, 10);

/** 7월 30일 — 달을 넘겨서 month 가 0 부터가 아니라 1 부터라는 것을 확인한다. */
const LAST_MONTH = new Date(2026, 6, 30, 9, 15).toISOString();

describe('visitedAgo', () => {
  it('같은 날에 본 기록은 today 다', () => {
    expect(visitedAgo(at(23, 9, 15), NOW)).toEqual({ kind: 'today' });
  });

  it('하루의 처음과 끝만큼 떨어져 있어도 같은 날이면 today 다 — 기준은 흐른 시간이 아니라 달력이다', () => {
    expect(visitedAgo(at(23, 0, 5), TONIGHT)).toEqual({ kind: 'today' });
  });

  it('하루 전에 본 기록은 yesterday 다', () => {
    expect(visitedAgo(at(22, 9, 15), NOW)).toEqual({ kind: 'yesterday' });
  });

  it('어젯밤 23:50 에 본 것은 오늘 00:10 에 yesterday 다 — 20분 차이여도 겪은 날은 어제다', () => {
    expect(visitedAgo(at(22, 23, 50), JUST_PAST_MIDNIGHT)).toEqual({ kind: 'yesterday' });
  });

  it('이틀 전부터는 날짜 수를 센다', () => {
    expect(visitedAgo(at(21, 9, 15), NOW)).toEqual({ kind: 'days', days: 2 });
  });

  it('엿새 전까지는 아직 날짜 수다', () => {
    expect(visitedAgo(at(17, 9, 15), NOW)).toEqual({ kind: 'days', days: 6 });
  });

  it('이레째부터는 날짜로 바뀐다 — 여기서부터 N일 전은 세어 봐야 아는 숫자다', () => {
    expect(visitedAgo(at(16, 9, 15), NOW)).toEqual({ kind: 'date', month: 8, day: 16 });
  });

  it('한참 전이면 그대로 그날의 월·일을 준다', () => {
    expect(visitedAgo(at(1, 9, 15), NOW)).toEqual({ kind: 'date', month: 8, day: 1 });
  });

  it('달을 넘긴 기록의 month 는 1 부터다 — 7월은 6 이 아니라 7 이다', () => {
    expect(visitedAgo(LAST_MONTH, NOW)).toEqual({ kind: 'date', month: 7, day: 30 });
  });

  it('시계가 어긋나 미래로 찍힌 기록도 today 다 — 음수 일수는 어떤 언어로도 문장이 되지 않는다', () => {
    expect(visitedAgo(at(24, 9, 0), NOW)).toEqual({ kind: 'today' });
    expect(visitedAgo(at(30, 9, 0), NOW)).toEqual({ kind: 'today' });
  });

  it('읽을 수 없는 값은 전부 null 이다 — 검증되지 않은 localStorage 에서 오므로 던지지 않는다', () => {
    // 타입은 string 이지만 값의 출처는 사람이 고칠 수 있는 저장소다. 필드가 통째로 빠진 기록이 온다.
    expect(visitedAgo(undefined as unknown as string, NOW)).toBeNull();
    expect(visitedAgo(null as unknown as string, NOW)).toBeNull();
    expect(visitedAgo('', NOW)).toBeNull();
    expect(visitedAgo('   ', NOW)).toBeNull();
    expect(visitedAgo('어제', NOW)).toBeNull();
    expect(visitedAgo('2026-08-32T00:00:00.000Z', NOW)).toBeNull();
  });
});
