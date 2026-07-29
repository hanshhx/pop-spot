import { describe, expect, it } from 'vitest';

import { bilingual } from './bilingual';

/**
 * 번역명과 원문을 함께 보여주는 규칙.
 *
 * <p>실제 팝업 이름 60건으로 재 봤을 때 드러난 것 — 번역명은 <b>무엇인지 알려주는 데는</b> 좋지만
 * <b>찾는 데는 못 쓴다.</b> 지도 앱에 "Knotted World" 를 넣으면 안 나오고 직원에게 말해도 통하지
 * 않는다. 그래서 둘 중 하나를 고르는 게 아니라 둘 다 보여준다.
 */
describe('bilingual', () => {
  it('번역이 있으면 번역을 크게, 원문을 함께 남긴다', () => {
    expect(bilingual('진격의 거인 팝업스토어', 'Attack on Titan Pop-up Store')).toEqual({
      display: 'Attack on Titan Pop-up Store',
      original: '진격의 거인 팝업스토어',
    });
  });

  it('번역이 없으면 원문만 — 병기하면 같은 줄이 두 번 나온다', () => {
    expect(bilingual('한복상점', null)).toEqual({ display: '한복상점', original: null });
    expect(bilingual('한복상점', undefined)).toEqual({ display: '한복상점', original: null });
  });

  it('번역이 원문과 같으면 병기하지 않는다', () => {
    // 백엔드가 걸러 내지만 화면에서도 막는다 — 같은 문자열이 위아래로 반복되면 고장으로 보인다.
    expect(bilingual('MUSINSA', 'MUSINSA')).toEqual({ display: 'MUSINSA', original: null });
    expect(bilingual('노티드 월드', ' 노티드 월드 ')).toEqual({
      display: '노티드 월드',
      original: null,
    });
  });

  it('빈 문자열은 번역이 없는 것으로 본다', () => {
    expect(bilingual('에르메스 팝업', '   ')).toEqual({
      display: '에르메스 팝업',
      original: null,
    });
  });

  it('원문이 없어도 번역을 쓴다 — 장소가 비어 있는 팝업이 실제로 있다', () => {
    expect(bilingual(null, 'The Hyundai Seoul')).toEqual({
      display: 'The Hyundai Seoul',
      original: null,
    });
  });

  it('둘 다 없으면 빈 결과 — 호출부가 대체 문구를 쓴다', () => {
    expect(bilingual(null, null)).toEqual({ display: null, original: null });
  });
});
