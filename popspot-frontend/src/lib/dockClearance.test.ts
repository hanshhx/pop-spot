import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 하단 도크 높이를 CSS 와 컴포넌트가 <b>같은 값으로</b> 알고 있는지 지킨다.
 *
 * <p>지도 컨트롤과 목록 시트는 도크에 가리지 않으려고 {@code --dock-h} 만큼 위로 올라온다.
 * 그런데 도크의 실제 높이는 {@code BottomDock.tsx} 의 Tailwind 클래스에서 나온다. 한쪽만 바뀌면
 * 화면은 멀쩡히 그려지고 <b>버튼만 조용히 도크 밑으로 들어간다.</b> 오류도 경고도 안 난다.
 *
 * <p>실측값이다 — 브라우저에서 도크를 재 보니 70px 이었다. 시안에 적힌 68px 은 틀렸다.
 */

const ROOT = path.resolve(__dirname, '../..');
const CSS = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
const DOCK = fs.readFileSync(path.join(ROOT, 'src/components/layout/BottomDock.tsx'), 'utf8');

/** Tailwind 간격 한 칸 = 4px. `p-1.5` 는 6px. */
const SPACING = 4;

describe('도크 높이', () => {
  it('BottomDock 이 아직 같은 방식으로 높이를 만든다', () => {
    // 이 셋 중 하나라도 바뀌면 아래 계산이 틀어진다. 그때는 다시 재고 --dock-h 를 고쳐야 한다.
    expect(DOCK).toMatch(/\bh-14\b/); // 버튼 56px
    expect(DOCK).toMatch(/\bsm:h-16\b/); // sm 부터 64px
    expect(DOCK).toMatch(/\bp-1\.5\b/); // 감싸는 칸 안쪽 여백 6px
    expect(DOCK).toMatch(/\bborder\b/); // 테두리 1px
  });

  it('--dock-h 가 실제 높이와 맞는다', () => {
    const button = 14 * SPACING; // h-14
    const padding = 1.5 * SPACING * 2; // p-1.5 위아래
    const border = 1 * 2;
    expect(button + padding + border).toBe(70);
    expect(CSS).toMatch(/--dock-h:\s*70px/);
  });

  it('sm 부터 커지는 것도 반영돼 있다', () => {
    // 도크는 lg 에서야 사라진다. 640~1023px 구간을 빠뜨리면 그 폭에서 여백이 0 이 된다.
    const smButton = 16 * SPACING; // sm:h-16
    expect(smButton + 1.5 * SPACING * 2 + 2).toBe(78);
    expect(CSS).toMatch(/@media\s*\(min-width:\s*640px\)\s*\{\s*:root\s*\{\s*--dock-h:\s*78px/);
  });

  it('--safe-b 가 도크가 실제로 쓰는 값과 같다', () => {
    // 도크는 max(0.5rem, ...) 로 뜬다. CSS 에 0.75rem 이라고 적으면(시안이 그렇다) 8px 어긋난다.
    expect(DOCK).toMatch(/max\(0\.5rem,\s*env\(safe-area-inset-bottom\)\)/);
    expect(CSS).toMatch(/--safe-b:\s*max\(0\.5rem,\s*env\(safe-area-inset-bottom\)\)/);
  });
});

describe('지도 컨트롤 비켜서기', () => {
  it('도크가 없는 화면에서는 0 이다', () => {
    // 같은 InteractiveMap 이 /map 에서도 쓰인다. 그 화면에는 도크가 없어 비켜설 이유가 없다.
    expect(CSS).toMatch(/--map-bottom-inset:\s*0px/);
  });

  it('lg 부터 다시 0 으로 돌아온다', () => {
    // 도크가 lg:hidden 이다. 안 되돌리면 데스크탑에서 컨트롤만 붕 뜬다.
    const scoped = CSS.slice(CSS.indexOf('.map-clears-dock'));
    expect(scoped).toMatch(
      /@media\s*\(min-width:\s*1024px\)\s*\{\s*\.map-clears-dock\s*\{\s*--map-bottom-inset:\s*0px/,
    );
  });

  it('훅이 찾는 표식이 도크에 붙어 있다', () => {
    // useMapBottomInset 은 [data-bottom-dock] 으로 도크를 찾아 잰다. 표식이 사라지면
    // 못 찾고 조용히 0 으로 돌아간다 — 오류도 경고도 없이 버튼만 도크 밑으로 들어간다.
    const hook = fs.readFileSync(path.join(ROOT, 'src/hooks/useMapBottomInset.ts'), 'utf8');
    expect(DOCK).toMatch(/data-bottom-dock/);
    expect(hook).toMatch(/\[data-bottom-dock\]/);
  });

  it('스크롤에 따라 다시 잰다', () => {
    // 카드는 문서 흐름 안, 도크는 화면에 고정이라 거리가 스크롤마다 변한다.
    // 한 번만 재면 그 지점에서만 맞는다 — 실제로 목록이 11px 만 남는 자리가 있었다.
    const hook = fs.readFileSync(path.join(ROOT, 'src/hooks/useMapBottomInset.ts'), 'utf8');
    expect(hook).toMatch(/addEventListener\('scroll'/);
    expect(hook).toMatch(/requestAnimationFrame/); // 스크롤마다 레이아웃을 읽으면 끊긴다
  });

  it('지도 쪽에 도크 숫자를 다시 적지 않는다', () => {
    // 숫자를 두 곳에 적는 순간 한쪽만 고쳐지고 어긋난다. 지도는 변수만 본다.
    const map = fs.readFileSync(path.join(ROOT, 'src/components/Map/InteractiveMap.tsx'), 'utf8');
    expect(map).toMatch(/var\(--map-bottom-inset/);
    expect(map).not.toMatch(/70px|78px|--dock-h/);
  });
});
