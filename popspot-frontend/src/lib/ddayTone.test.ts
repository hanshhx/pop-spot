import { describe, expect, it } from 'vitest';

import { DDAY_TONE_CLASS, URGENT_DAYS, ddayTone } from './ddayTone';

describe('ddayTone', () => {
  it('마감일을 모르면 배지를 그리지 않는다', () => {
    expect(ddayTone(null)).toBeNull();
  });

  it('이미 끝난 것은 ended', () => {
    expect(ddayTone(-1)).toBe('ended');
    expect(ddayTone(-30)).toBe('ended');
  });

  it('3일 이하만 색을 쓴다', () => {
    expect(ddayTone(0)).toBe('urgent');
    expect(ddayTone(3)).toBe('urgent');
  });

  it('4일부터는 차분하게', () => {
    // 예전에는 4~7일이 호박색, 그 뒤는 라임이었다. 목록 전체가 강조색이 되던 원인이다.
    expect(ddayTone(4)).toBe('calm');
    expect(ddayTone(60)).toBe('calm');
  });

  it('경계는 URGENT_DAYS 를 따른다', () => {
    // 상수를 고치면 이 시험이 같이 움직여야 한다. 숫자를 두 곳에 적어 두지 않는다.
    expect(ddayTone(URGENT_DAYS)).toBe('urgent');
    expect(ddayTone(URGENT_DAYS + 1)).toBe('calm');
  });
});

describe('DDAY_TONE_CLASS', () => {
  it('색을 쓰는 것은 urgent 하나뿐이다', () => {
    // 이 시험이 이 파일의 존재 이유다. 다시 여러 색으로 늘어나면 여기서 걸린다.
    expect(DDAY_TONE_CLASS.urgent).toBe('season-signal');
    expect(DDAY_TONE_CLASS.calm).not.toMatch(/bg-(hot|lime|red|orange|amber)-/);
    expect(DDAY_TONE_CLASS.ended).not.toMatch(/bg-(hot|lime|red|orange|amber)-/);
  });

  it('급한 배지는 계절 신호를 쓴다 — 고정 브랜드색이 아니라', () => {
    // 예전에는 bg-hot-400 하나로 못박혀 있었다. 이제 이 배지는 계절이 화면에서 말을 거는
    // 다섯 자리 중 하나라, 색을 스스로 정하지 않고 --s-hi 를 따른다(seasons.css).
    //
    // 실제 색 조합(--s-hi 와 그 위 글자색)이 대비를 넘는지는 여기서 확인할 수 없다.
    // CSS 변수라 계절·테마 8조합에서 값이 달라지기 때문이다 — 브라우저에서 실측한다.
    expect(DDAY_TONE_CLASS.urgent).not.toMatch(/bg-|text-/);
  });
});
