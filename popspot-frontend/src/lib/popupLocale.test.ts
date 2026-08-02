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
});
