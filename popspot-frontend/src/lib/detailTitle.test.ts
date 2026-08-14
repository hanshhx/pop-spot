import { describe, expect, it } from 'vitest';

import { popupDetailTitle } from './detailTitle';

describe('popupDetailTitle', () => {
  it('팝업이라는 말이 없는 이름에는 검색 의도를 붙인다', () => {
    expect(popupDetailTitle('산리오 캐릭터즈')).toBe('산리오 캐릭터즈 팝업 일정·위치');
  });

  it('이미 팝업스토어가 있으면 반복하지 않는다', () => {
    expect(popupDetailTitle('산리오 팝업스토어')).toBe('산리오 팝업스토어 일정·위치');
  });

  it('공백뿐인 이름도 거짓 이름을 만들지 않고 일반 제목으로 돌린다', () => {
    expect(popupDetailTitle('   ')).toBe('서울 팝업 일정·위치');
  });
});
