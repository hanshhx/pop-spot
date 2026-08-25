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
    expect(detailStatusLabel('EXPIRED', ended, t)).toBe('translated:misc.cardEnded');
  });

  it('끝났으면 상태 문자열이 영업중이어도 종료 라벨을 우선한다', () => {
    expect(detailStatusLabel('영업중', true, t)).toBe('translated:misc.cardEnded');
  });

  it('안 끝났고 상태가 있으면 popupStatusLabel 이 번역한 값을 그대로 쓴다', () => {
    expect(detailStatusLabel('영업중', false, t)).toBe('translated:status.open');
  });

  it('상태가 비어 있으면 영업중으로 넘겨짚지 않고 상태 미상 라벨을 보여준다', () => {
    expect(detailStatusLabel(null, false, t)).toBe('translated:status.unknown');
    expect(detailStatusLabel('', false, t)).toBe('translated:status.unknown');
    expect(detailStatusLabel(undefined, false, t)).toBe('translated:status.unknown');
  });
});
