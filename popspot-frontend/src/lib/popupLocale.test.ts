import { describe, expect, it } from 'vitest';
import { popupStatusLabel } from './popupLocale';

describe('팝업 상태 번역', () => {
  const t = (key: string) => `translated:${key}`;

  it('한국어 원시 상태와 영어 코드를 같은 번역 키로 연결한다', () => {
    expect(popupStatusLabel('운영중', t)).toBe('translated:status.open');
    expect(popupStatusLabel('OPEN', t)).toBe('translated:status.open');
    expect(popupStatusLabel('혼잡', t)).toBe('translated:status.혼잡');
  });

  it('모르는 상태는 지어내지 않고 원문을 남긴다', () => {
    expect(popupStatusLabel('CHECK_REQUIRED', t)).toBe('CHECK_REQUIRED');
  });

  it('상태를 모르면 null 이다 — 근거 없이 "영업중" 이라고 단정하지 않는다', () => {
    expect(popupStatusLabel(null, t)).toBeNull();
    expect(popupStatusLabel(undefined, t)).toBeNull();
    expect(popupStatusLabel('', t)).toBeNull();
    expect(popupStatusLabel('   ', t)).toBeNull();
  });

  it('백엔드가 실제로 준 상태는 여전히 그대로 번역한다', () => {
    expect(popupStatusLabel('영업중', t)).toBe('translated:status.open');
    expect(popupStatusLabel('EXPIRED', t)).toBe('translated:misc.cardEnded');
  });
});
