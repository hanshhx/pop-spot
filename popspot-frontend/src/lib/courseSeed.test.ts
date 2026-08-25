import { describe, expect, it } from 'vitest';

import { toCourseSeed } from './courseSeed';

describe('toCourseSeed', () => {
  it('이름에 든 파이프 문자를 지운다 — 시드가 name|lat|lng 로 직렬화되기 때문이다', () => {
    // 실측 사례: /popspot 라이브 데이터 1,181행 중 파이프가 든 유일한 이름.
    const got = toCourseSeed([
      { name: 'TOY STORY | PEACEMINUSONE : THE FIRST FAN', lat: 37.5, lng: 127.0 },
    ]);
    expect(got[0].name).not.toContain('|');
  });

  it('파이프를 지운 뒤에도 읽을 수 있는 이름을 남긴다', () => {
    const got = toCourseSeed([{ name: 'A | B', lat: 37.5, lng: 127.0 }]);
    expect(got[0].name.trim()).not.toBe('');
  });

  it('좌표가 유한하지 않으면 통째로 뺀다', () => {
    const got = toCourseSeed([{ name: '깨진 것', lat: NaN, lng: 127.0 }]);
    expect(got).toEqual([]);
  });

  it('멀쩡한 항목은 그대로 통과시킨다', () => {
    const got = toCourseSeed([{ name: '성수연방', lat: 37.5436, lng: 127.0561 }]);
    expect(got).toEqual([{ name: '성수연방', lat: 37.5436, lng: 127.0561 }]);
  });

  it('100자를 넘는 이름은 100자로 잘라내되 빈 문자열로 만들지는 않는다 — 서버가 100자 초과 이름을 통째로 거절한다', () => {
    const longName = 'A'.repeat(150);
    const got = toCourseSeed([{ name: longName, lat: 37.5, lng: 127.0 }]);
    expect(got[0].name.length).toBe(100);
    expect(got[0].name).not.toBe('');
  });

  it('입력 순서를 그대로 유지한다 — 앵커를 배열 맨 앞에 두면 결과에서도 맨 앞이다', () => {
    const got = toCourseSeed([
      { name: '앵커(이 팝업)', lat: 37.5447, lng: 127.0557 },
      { name: '이웃 1', lat: 37.5436, lng: 127.0561 },
      { name: '이웃 2', lat: 37.5414, lng: 127.0559 },
    ]);
    expect(got.map((i) => i.name)).toEqual(['앵커(이 팝업)', '이웃 1', '이웃 2']);
  });
});
