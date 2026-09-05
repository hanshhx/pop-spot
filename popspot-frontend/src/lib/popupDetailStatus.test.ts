import { describe, expect, it } from 'vitest';

import {
  detailPeriodBadge,
  detailStatusLabel,
  isPopupEnded,
  isUrgentPeriod,
} from './popupDetailStatus';
import { kstTodayStart } from './popupSlices';

const TODAY = new Date('2026-08-25');
const t = (key: string) => `translated:${key}`;

describe('isPopupEnded', () => {
  it('종료일이 오늘보다 이전이면 끝난 것으로 본다', () => {
    expect(isPopupEnded('영업중', '2026-08-20', TODAY)).toBe(true);
  });

  it('종료일이 아직 안 지났고 상태도 영업중이면 안 끝난 것이다', () => {
    expect(isPopupEnded('영업중', '2026-09-01', TODAY)).toBe(false);
  });

  it('종료일이 없어도 상태가 EXPIRED면 끝난 것으로 본다 — 날짜만 보면 놓치는 경우다', () => {
    expect(isPopupEnded('EXPIRED', null, TODAY)).toBe(true);
  });

  it('상태가 한국어 종료여도 끝난 것으로 본다', () => {
    expect(isPopupEnded('종료', undefined, TODAY)).toBe(true);
  });

  it('종료일이 이미 지났으면 상태가 아직 영업중이어도 끝난 것으로 본다 — 스케줄러 지연 창을 메운다', () => {
    expect(isPopupEnded('영업중', '2026-08-24', TODAY)).toBe(true);
  });

  it('날짜도 없고 상태도 비어 있으면 끝났다고 단정하지 않는다', () => {
    expect(isPopupEnded(null, null, TODAY)).toBe(false);
  });
});

describe('detailStatusLabel', () => {
  it('EXPIRED 상태는 원문 토큰이 아니라 번역된 종료 라벨을 보여준다', () => {
    const ended = isPopupEnded('EXPIRED', null, TODAY);
    expect(detailStatusLabel('EXPIRED', ended, null, null, t, TODAY)).toBe(
      'translated:misc.cardEnded',
    );
  });

  it('끝났으면 상태 문자열이 영업중이어도 종료 라벨을 우선한다', () => {
    expect(detailStatusLabel('영업중', true, null, null, t, TODAY)).toBe(
      'translated:misc.cardEnded',
    );
  });

  it('안 끝났고 상태가 있으면 popupStatusLabel 이 번역한 값을 그대로 쓴다', () => {
    expect(detailStatusLabel('영업중', false, null, null, t, TODAY)).toBe('translated:status.open');
  });

  it(
    '명시적 status 는 날짜와 모순돼도 이긴다 — 날짜는 status 가 없을 때만 쓰는 폴백이지 ' +
      '뒤집는 근거가 아니다',
    () => {
      // status 는 영업중인데 날짜만 보면 아직 시작 전(upcoming)인 모순 상황.
      const ended = isPopupEnded('영업중', '2026-12-31', TODAY);
      expect(detailStatusLabel('영업중', ended, '2026-12-01', '2026-12-31', t, TODAY)).toBe(
        'translated:status.open',
      );
    },
  );

  it(
    '명시적 EXPIRED 는 종료일이 미래여도 이긴다 — 스케줄러가 미리 끝난 걸로 표시한 경우도 ' +
      '날짜로 뒤집지 않는다',
    () => {
      const ended = isPopupEnded('EXPIRED', '2099-01-01', TODAY);
      expect(detailStatusLabel('EXPIRED', ended, '2026-01-01', '2099-01-01', t, TODAY)).toBe(
        'translated:misc.cardEnded',
      );
    },
  );

  it(
    'status 가 없어도 날짜만으로 지금 열려 있는지 알 수 있으면 정보 없음이라고 하지 않는다 — ' +
      'T1 암행천문(07-22~08-31, 오늘 08-25)처럼 기간·D-day 는 이미 계산해 보여주면서 배지만 ' +
      '모른다고 하면 한 화면이 스스로와 모순된다',
    () => {
      const ended = isPopupEnded(null, '2026-08-31', TODAY);
      expect(detailStatusLabel(null, ended, '2026-07-22', '2026-08-31', t, TODAY)).toBe(
        'translated:status.open',
      );
    },
  );

  it('status 가 없고 날짜로 보면 아직 시작 전이면 오픈 예정 라벨을 보여준다', () => {
    const ended = isPopupEnded(null, '2026-09-30', TODAY);
    expect(detailStatusLabel(null, ended, '2026-09-01', '2026-09-30', t, TODAY)).toBe(
      'translated:status.upcoming',
    );
  });

  it('status 가 없어도 시작일만으로 이미 열린 것을 안다(종료일 미상)', () => {
    const ended = isPopupEnded(null, null, TODAY);
    expect(detailStatusLabel(null, ended, '2026-08-01', null, t, TODAY)).toBe(
      'translated:status.open',
    );
  });

  it('상태도 없고 날짜도 하나도 못 읽으면 그제서야 상태 미상 라벨을 보여준다', () => {
    expect(detailStatusLabel(null, false, null, null, t, TODAY)).toBe('translated:status.unknown');
    expect(detailStatusLabel('', false, undefined, undefined, t, TODAY)).toBe(
      'translated:status.unknown',
    );
    expect(detailStatusLabel(undefined, false, '이상한 날짜', 'not-a-date', t, TODAY)).toBe(
      'translated:status.unknown',
    );
  });

  it('공백뿐인 상태는 popupStatusLabel 이 null 을 돌려줘도 정보 없음으로 끊기지 않고 날짜 파생으로 이어진다', () => {
    // popupStatusLabel('   ', t) 는 null 이다 — 그 null 이 여기서 단정으로 되살아나지 않고
    // 아래 날짜 파생 분기로 흘러가야 한다(restructure 의 핵심).
    const ended = isPopupEnded('   ', '2026-08-31', TODAY);
    expect(detailStatusLabel('   ', ended, '2026-07-22', '2026-08-31', t, TODAY)).toBe(
      'translated:status.open',
    );
  });
});

/**
 * 이 검사들이 지키는 것은 하나다 — <b>아직 안 연 팝업에 마감 D-day 를 붙이지 않는다.</b>
 *
 * <p>실제로 그랬다. 릴 X 토니노 람보르기니(09-15~09-23)를 09-05 에 열면 배지는 '오픈 예정' 인데
 * 그 옆이 'D-18'(마감까지) 이었다. 사람은 "18일 뒤에 연다"로 읽지만 실제로는 10일 뒤였다.
 * 같은 화면의 두 값이 서로 다른 것을 세고 있었다.
 */
describe('detailPeriodBadge', () => {
  const 오늘 = new Date('2026-09-05T00:00:00+09:00');

  it('아직 안 열었으면 열기까지 센다 — 마감까지가 아니라', () => {
    expect(detailPeriodBadge('2026-09-15', '2026-09-23', 오늘)).toEqual({
      kind: 'opens-in',
      days: 10,
    });
  });

  it('열려 있으면 마감까지 센다', () => {
    expect(detailPeriodBadge('2026-09-01', '2026-09-23', 오늘)).toEqual({
      kind: 'closes-in',
      days: 18,
    });
  });

  it('오늘 마감이면 따로 알린다 — D-0 은 숫자로 읽히지 않는다', () => {
    expect(detailPeriodBadge('2026-09-01', '2026-09-05', 오늘)).toEqual({ kind: 'closing-today' });
  });

  it('끝났으면 끝난 것으로 준다', () => {
    expect(detailPeriodBadge('2026-08-01', '2026-09-04', 오늘)).toEqual({ kind: 'ended' });
  });

  /* 시작 당일은 '오늘 연다'가 아니라 진행 중이다 — landingStatus 가 toStart > 0 만 upcoming 으로 본다. */
  it('시작 당일은 진행 중으로 본다', () => {
    expect(detailPeriodBadge('2026-09-05', '2026-09-23', 오늘)).toEqual({
      kind: 'closes-in',
      days: 18,
    });
  });

  it('상시 운영(종료일 없음)은 셀 것이 없어 배지를 안 그린다', () => {
    expect(detailPeriodBadge('2026-09-01', null, 오늘)).toBeNull();
  });

  it('날짜가 하나도 없으면 배지를 안 그린다', () => {
    expect(detailPeriodBadge(null, null, 오늘)).toBeNull();
    expect(detailPeriodBadge(undefined, '', 오늘)).toBeNull();
  });

  /*
   * 시작일만 있고 종료일이 없는 건. 아직 안 열었으면 열기까지는 셀 수 있다 —
   * 마감을 모른다고 오픈 예정 정보까지 숨길 이유가 없다.
   */
  it('종료일을 몰라도 아직 안 열었으면 열기까지는 센다', () => {
    expect(detailPeriodBadge('2026-09-15', null, 오늘)).toEqual({ kind: 'opens-in', days: 10 });
  });
});

/**
 * 인자를 안 줄 때의 '오늘'을 못박는다.
 *
 * <p>이 함수의 예전 자리({@code ddayLabel})는 {@code dday.ts} 의 {@code daysUntilEnd} 를 기본
 * 인자로 불렀고, 그쪽은 로컬 {@code setHours} 로 오늘을 만든다. 이 화면은 서버에서도 그려지는데
 * Vercel 은 UTC 라, KST 00:00~09:00 사이 9시간 동안 서버가 센 날짜가 하루 밀렸다.
 *
 * <p><b>이 검사의 한계를 적어 둔다.</b> 개발 PC 는 KST 라 로컬 자정과 KST 자정이 같아서 여기서는
 * 기본값을 바꿔도 안 걸린다. 걸리는 곳은 <b>UTC 로 도는 CI 와 Vercel</b> 이고, 버그가 살던 곳도
 * 정확히 거기다. 다른 검사들은 모두 today 를 명시로 넘기므로 기본값을 보는 것은 이 검사뿐이다.
 */
describe('detailPeriodBadge — 오늘의 기준', () => {
  it('오늘을 안 주면 KST 자정을 쓴다', () => {
    const 인자없이 = detailPeriodBadge('2026-09-15', '2026-09-23');
    const KST명시 = detailPeriodBadge('2026-09-15', '2026-09-23', kstTodayStart());
    expect(인자없이).toEqual(KST명시);
  });
});

describe('isUrgentPeriod', () => {
  it('마감이 걸린 것만 강조한다', () => {
    expect(isUrgentPeriod({ kind: 'closing-today' })).toBe(true);
    expect(isUrgentPeriod({ kind: 'closes-in', days: 3 })).toBe(true);
  });

  /* 열흘 뒤에 여는 팝업이 마감 임박과 같은 색이면 두 상황을 구분할 수 없다. */
  it('아직 안 연 것과 끝난 것은 강조하지 않는다', () => {
    expect(isUrgentPeriod({ kind: 'opens-in', days: 10 })).toBe(false);
    expect(isUrgentPeriod({ kind: 'ended' })).toBe(false);
    expect(isUrgentPeriod(null)).toBe(false);
  });
});
