import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NOTIFY_SETTINGS,
  canNotify,
  isQuietHour,
  pruneSent,
  type SentRecord,
} from './notifyRules';

/** 2026-08-30 14:00 — 보내도 되는 시간. */
const NOON = new Date(2026, 7, 30, 14, 0, 0);
const HOUR = 60 * 60 * 1000;

const sent = (over: Partial<SentRecord> = {}): SentRecord => ({
  kind: 'wishClosing',
  popupId: 1,
  at: NOON.getTime() - HOUR,
  ...over,
});

describe('isQuietHour', () => {
  it('21시부터 다음 날 9시까지는 조용히 있는다', () => {
    expect(isQuietHour(new Date(2026, 7, 30, 21, 0))).toBe(true);
    expect(isQuietHour(new Date(2026, 7, 30, 23, 30))).toBe(true);
    expect(isQuietHour(new Date(2026, 7, 30, 3, 0))).toBe(true);
    expect(isQuietHour(new Date(2026, 7, 30, 8, 59))).toBe(true);
  });

  it('9시부터 21시 전까지는 보낼 수 있다', () => {
    expect(isQuietHour(new Date(2026, 7, 30, 9, 0))).toBe(false);
    expect(isQuietHour(new Date(2026, 7, 30, 20, 59))).toBe(false);
  });
});

describe('canNotify', () => {
  it('설정이 켜져 있고 시간대가 맞으면 보낸다', () => {
    expect(canNotify({ kind: 'wishClosing', popupId: 1 }, DEFAULT_NOTIFY_SETTINGS, [], NOON)).toEqual({
      send: true,
    });
  });

  it('꺼 둔 종류는 보내지 않는다', () => {
    const decision = canNotify({ kind: 'newPopup', popupId: 1 }, DEFAULT_NOTIFY_SETTINGS, [], NOON);
    expect(decision).toEqual({ send: false, reason: 'off' });
  });

  it('조용한 시간에는 보내지 않는다', () => {
    const night = new Date(2026, 7, 30, 22, 0);
    expect(canNotify({ kind: 'wishClosing', popupId: 1 }, DEFAULT_NOTIFY_SETTINGS, [], night)).toEqual({
      send: false,
      reason: 'quietHours',
    });
  });

  it('하루 두 건을 넘기지 않는다', () => {
    const two = [sent({ popupId: 10 }), sent({ popupId: 11 })];
    expect(canNotify({ kind: 'wishClosing', popupId: 12 }, DEFAULT_NOTIFY_SETTINGS, two, NOON)).toEqual({
      send: false,
      reason: 'dailyLimit',
    });
  });

  /* 어제 두 건을 보냈다고 오늘까지 막히면 안 된다. */
  it('상한은 하루 단위로 다시 센다', () => {
    const yesterday = [
      sent({ popupId: 10, at: NOON.getTime() - 26 * HOUR }),
      sent({ popupId: 11, at: NOON.getTime() - 27 * HOUR }),
    ];
    expect(canNotify({ kind: 'wishClosing', popupId: 12 }, DEFAULT_NOTIFY_SETTINGS, yesterday, NOON)).toEqual(
      { send: true },
    );
  });

  it('같은 팝업은 24시간에 한 번만', () => {
    expect(
      canNotify({ kind: 'wishClosing', popupId: 1 }, DEFAULT_NOTIFY_SETTINGS, [sent()], NOON),
    ).toEqual({ send: false, reason: 'samePopupCooldown' });
  });

  it('24시간이 지나면 같은 팝업도 다시 보낼 수 있다', () => {
    const old = sent({ at: NOON.getTime() - 25 * HOUR });
    expect(canNotify({ kind: 'wishClosing', popupId: 1 }, DEFAULT_NOTIFY_SETTINGS, [old], NOON)).toEqual({
      send: true,
    });
  });

  /* 주간 요약처럼 특정 팝업이 없는 알림은 같은-팝업 규칙에 걸리지 않아야 한다. */
  it('팝업이 없는 알림은 같은-팝업 규칙을 적용하지 않는다', () => {
    expect(
      canNotify({ kind: 'weekly', popupId: null }, DEFAULT_NOTIFY_SETTINGS, [sent({ popupId: null })], NOON),
    ).toEqual({ send: true });
  });

  /* 꺼 놓은 알림이 "하루 상한 때문에" 안 나갔다고 기록되면 설정을 껐다는 사실이 사라진다. */
  it('여러 이유가 겹치면 사용자가 정한 것을 먼저 말한다', () => {
    const night = new Date(2026, 7, 30, 22, 0);
    const two = [sent({ popupId: 10 }), sent({ popupId: 11 })];
    expect(canNotify({ kind: 'newPopup', popupId: 1 }, DEFAULT_NOTIFY_SETTINGS, two, night)).toEqual({
      send: false,
      reason: 'off',
    });
  });
});

describe('pruneSent', () => {
  it('이틀 넘은 기록은 버린다 — 규칙에 필요한 만큼만 갖고 있는다', () => {
    const records = [
      sent({ at: NOON.getTime() - 1 * HOUR }),
      sent({ at: NOON.getTime() - 47 * HOUR }),
      sent({ at: NOON.getTime() - 49 * HOUR }),
    ];
    expect(pruneSent(records, NOON)).toHaveLength(2);
  });
});
