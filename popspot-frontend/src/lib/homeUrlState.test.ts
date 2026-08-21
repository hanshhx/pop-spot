import { describe, expect, it } from 'vitest';

import { nextHomeUrl, parsePanel, parseTab } from './homeUrlState';

describe('parseTab', () => {
  it('아는 탭만 받아들이고 대소문자는 맞춰 준다', () => {
    expect(parseTab('COURSE')).toBe('COURSE');
    expect(parseTab('course')).toBe('COURSE');
  });

  it('모르는 값은 무시한다', () => {
    // 주소는 누구나 고쳐 쓸 수 있다. 모르는 값이 상태로 들어가면 빈 화면이 된다.
    expect(parseTab('ADMIN')).toBeNull();
    expect(parseTab('')).toBeNull();
    expect(parseTab(null)).toBeNull();
  });
});

describe('parsePanel', () => {
  it('푸터에서 여는 두 가지만 받는다', () => {
    expect(parsePanel('calendar')).toBe('calendar');
    expect(parsePanel('CONGESTION')).toBe('congestion');
    expect(parsePanel('login')).toBeNull();
  });
});

describe('nextHomeUrl', () => {
  it('기본 탭이면 매개변수를 붙이지 않는다', () => {
    // /?tab=MAP 과 / 가 같은 화면인데 주소가 갈리면 공유 링크도 집계도 쪼개진다.
    expect(nextHomeUrl('https://popspot.co.kr/', 'MAP')).toBe('/');
    expect(nextHomeUrl('https://popspot.co.kr/?tab=COURSE', 'MAP')).toBe('/');
  });

  it('기본이 아닌 탭은 매개변수로 남긴다', () => {
    expect(nextHomeUrl('https://popspot.co.kr/', 'COURSE')).toBe('/?tab=COURSE');
  });

  it('탭을 바꾸면 열려 있던 패널 표시는 지운다', () => {
    // 남겨 두면 새로고침할 때마다 캘린더가 다시 열린다.
    expect(nextHomeUrl('https://popspot.co.kr/?open=calendar', 'COURSE')).toBe('/?tab=COURSE');
    expect(nextHomeUrl('https://popspot.co.kr/?open=calendar', 'MAP')).toBe('/');
  });

  it('다른 매개변수는 건드리지 않는다', () => {
    // 유입 경로 추적용 값이 탭을 눌렀다고 사라지면 안 된다.
    expect(nextHomeUrl('https://popspot.co.kr/?utm_source=naver', 'COURSE')).toBe(
      '/?utm_source=naver&tab=COURSE',
    );
  });

  it('모르는 탭 값으로는 매개변수를 만들지 않는다', () => {
    expect(nextHomeUrl('https://popspot.co.kr/?tab=COURSE', 'NOPE')).toBe('/');
  });
});
