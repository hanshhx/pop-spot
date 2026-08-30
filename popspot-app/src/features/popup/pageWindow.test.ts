import { describe, expect, it } from 'vitest';
import { pageWindow } from './pageWindow';

describe('pageWindow', () => {
  it('페이지가 하나뿐이면 그 하나만 준다', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it('페이지가 몇 개 안 되면 전부 그대로 준다', () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('가운데에 있으면 처음·끝과 앞뒤 한 칸만 남기고 사이를 접는다', () => {
    // 마흔 페이지를 다 그리면 그 줄이 화면을 먹는다.
    expect(pageWindow(20, 40)).toEqual([1, 'gap', 19, 20, 21, 'gap', 40]);
  });

  it('첫 페이지에서는 앞쪽에 접을 것이 없다', () => {
    expect(pageWindow(1, 40)).toEqual([1, 2, 'gap', 40]);
  });

  it('마지막 페이지에서는 뒤쪽에 접을 것이 없다', () => {
    expect(pageWindow(40, 40)).toEqual([1, 'gap', 39, 40]);
  });

  it('접힐 자리가 한 칸뿐이면 접지 않고 그 번호를 보여준다', () => {
    // 2 를 숨기고 '…' 를 넣으면 차지하는 자리는 그대로인데 누를 수 있는 것이 하나 줄어든다.
    expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('접힐 자리가 두 칸 이상이면 접는다', () => {
    expect(pageWindow(5, 7)).toEqual([1, 'gap', 4, 5, 6, 7]);
  });

  it('같은 번호를 두 번 넣지 않는다', () => {
    for (let total = 1; total <= 12; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        const nums = pageWindow(page, total).filter((p): p is number => p !== 'gap');
        expect(new Set(nums).size).toBe(nums.length);
      }
    }
  });

  it('언제나 오름차순이고 범위를 벗어나지 않는다', () => {
    for (let total = 1; total <= 30; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        const nums = pageWindow(page, total).filter((p): p is number => p !== 'gap');
        expect(nums).toEqual([...nums].sort((a, b) => a - b));
        expect(nums.every((n) => n >= 1 && n <= total)).toBe(true);
      }
    }
  });

  it('현재 페이지는 언제나 들어 있다', () => {
    for (let total = 1; total <= 30; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        expect(pageWindow(page, total)).toContain(page);
      }
    }
  });
});
