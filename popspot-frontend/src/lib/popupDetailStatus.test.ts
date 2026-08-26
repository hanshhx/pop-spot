import { describe, expect, it } from 'vitest';

import { detailStatusLabel, isPopupEnded } from './popupDetailStatus';

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
