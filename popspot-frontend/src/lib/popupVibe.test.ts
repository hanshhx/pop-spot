import { describe, expect, it } from 'vitest';

import { popupVibe } from './popupVibe';

describe('popupVibe', () => {
  it('카테고리가 있으면 그 카테고리의 무드 단어를 쓴다 — 이름을 그대로 꽂으면 AI 프롬프트 문장이 깨진다', () => {
    const got = popupVibe({ category: 'FOOD', name: '아무 이름' });
    expect(got).toBe('맛집');
  });

  it('카테고리가 없으면 팝업 이름으로 대신한다', () => {
    const got = popupVibe({ category: undefined, name: '성수연방' });
    expect(got).toBe('성수연방');
  });

  it('이름이 아주 길면(브랜드 콜라보명 등) 쿼리스트링에 실을 만큼 잘라낸다', () => {
    const longName = 'TOY STORY x PEACEMINUSONE THE FIRST FAN MEETING POP-UP STORE';
    const got = popupVibe({ category: undefined, name: longName });
    expect(got.length).toBe(20);
    expect(longName.startsWith(got)).toBe(true);
  });
});
