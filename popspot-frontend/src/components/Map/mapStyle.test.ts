// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildBaseStyle } from './mapStyle';
import { parseHex } from '@/lib/colorMix';

/**
 * 지도 팔레트가 <b>화면과 같은 편</b>인지 지킨다.
 *
 * <p>실제로 뒤집힌 적이 있다: 라이트 화면에 다크 지도가, 다크 화면에 라이트 지도가 깔렸다.
 * 지도는 브라우저에서 WebGL 로 그려져 눈으로만 확인하던 부분이라 아무도 못 잡았다. 색이
 * 정해지는 곳은 순수 함수이므로 여기서 잠근다.
 *
 * <p>jsdom 에는 CSS 가 없어 계절 토큰(--s-map)이 비어 있고, 그러면 THEMES 의 기본값으로
 * 떨어진다. 계절색까지는 못 보지만 <b>어느 쪽 팔레트를 골랐는가</b>는 그대로 드러난다.
 */

/** 이 레이어의 fill-color. 스타일 스펙에서 직접 꺼낸다. */
function fillOf(style: ReturnType<typeof buildBaseStyle>, id: string): string {
  const layer = style.layers.find((l) => l.id === id);
  if (!layer || !('paint' in layer)) throw new Error(`${id} 레이어가 없다`);
  const paint = layer.paint as Record<string, unknown>;
  const color = paint['fill-color'] ?? paint['background-color'];
  if (typeof color !== 'string') throw new Error(`${id} 의 색이 문자열이 아니다`);
  return color;
}

/** 0(검정) ~ 1(흰색). 어느 쪽 팔레트인지 가르는 데만 쓴다. */
function brightness(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`hex 가 아니다: ${hex}`);
  return (rgb[0] + rgb[1] + rgb[2]) / 3 / 255;
}

const setDark = (on: boolean) => document.documentElement.classList.toggle('dark', on);

afterEach(() => document.documentElement.classList.remove('dark'));

describe('buildBaseStyle', () => {
  it('다크 화면에는 어두운 지도를 준다', () => {
    setDark(true);
    expect(brightness(fillOf(buildBaseStyle('dark', 'x'), 'earth'))).toBeLessThan(0.25);
  });

  it('라이트 화면에는 밝은 지도를 준다', () => {
    setDark(false);
    expect(brightness(fillOf(buildBaseStyle('light', 'x'), 'earth'))).toBeGreaterThan(0.75);
  });

  it('넘겨받은 mode 가 문서와 어긋나면 문서를 따른다', () => {
    /*
     * 색의 출처가 둘이라 생기는 문제다. 바탕은 CSS 변수(=문서의 .dark 클래스)에서 오고 나머지는
     * React 가 넘긴 mode 에서 왔다. 둘이 어긋나면 반쪽은 다크, 반쪽은 라이트인 지도가 나온다.
     * 변수를 읽는 그 문서를 따르는 것이 유일하게 앞뒤가 맞는 선택이다.
     */
    setDark(true);
    expect(brightness(fillOf(buildBaseStyle('light', 'x'), 'earth'))).toBeLessThan(0.25);

    setDark(false);
    expect(brightness(fillOf(buildBaseStyle('dark', 'x'), 'earth'))).toBeGreaterThan(0.75);
  });

  it('도로는 두 모드 모두 바탕보다 밝다', () => {
    // 라이트에서 도로가 검게 나온 적이 있다 — 도로와 글자에 같은 기준점을 줘서, 글자가 가는
    // 어두운 쪽으로 도로까지 따라갔다.
    for (const dark of [true, false]) {
      setDark(dark);
      const style = buildBaseStyle(dark ? 'dark' : 'light', 'x');
      const earth = brightness(fillOf(style, 'earth'));
      const road = brightness(
        (style.layers.find((l) => l.id === 'roads-minor')?.paint as Record<string, string>)?.[
          'line-color'
        ] ?? '#000000',
      );
      expect(road, dark ? 'dark' : 'light').toBeGreaterThan(earth);
    }
  });
});

/**
 * <b>타일 파일이 어디에 있느냐는 배포 비용 문제다.</b>
 *
 * <p>이 파일은 56MB 다. {@code public/} 에 두면 호스팅이 <b>배포마다 한 벌씩</b> 보관한다 —
 * 2026-09-19 에 Vercel 의 Deployment Storage 가 10GB 한도에 53.4GB 로 차서 배포가 정지됐고,
 * 배포 수(약 640)와 56MB 의 곱이 그 값과 맞았다. 대역폭이 아니라 <b>저장소</b>가 먼저 터진
 * 것이라 캐시 헤더로는 손댈 수 없고, 파일을 바깥으로 빼는 것 말고 방법이 없다.
 *
 * <p>그래서 검사하는 것은 "바깥 주소를 줬을 때 실제로 그쪽을 쓰는가" 하나다. 이게 참이어야
 * {@code public/seoul.pmtiles} 를 지울 수 있다.
 *
 * <p><b>{@code /basemap} 라우트는 일부러 건드리지 않았다.</b> 그쪽 테스트에 "목적지는 코드가
 * 정해야지 배포 설정이 정하면 안 된다" 는 판단이 근거와 함께 적혀 있고, 지금 지도는 그 경로를
 * 거치지 않고 파일을 직접 부르므로 바꿔서 얻을 것이 없다.
 */
describe('basemapTileUrl — 타일 파일을 어디서 받는가', () => {
  async function load(external?: string) {
    vi.resetModules();
    if (external === undefined) vi.stubEnv('NEXT_PUBLIC_BASEMAP_URL', '');
    else vi.stubEnv('NEXT_PUBLIC_BASEMAP_URL', external);
    return (await import('./mapStyle')).basemapTileUrl;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('설정이 없으면 예전처럼 우리 도메인의 동봉 파일을 쓴다', async () => {
    const basemapTileUrl = await load();
    expect(basemapTileUrl()).toMatch(/^pmtiles:\/\/.*\/seoul\.pmtiles$/);
  });

  it('바깥 주소를 주면 그쪽을 쓴다 — 이게 되어야 public/ 에서 56MB 를 뺄 수 있다', async () => {
    const basemapTileUrl = await load('https://cdn.example/seoul.pmtiles');
    expect(basemapTileUrl()).toBe('pmtiles://https://cdn.example/seoul.pmtiles');
  });

  it('버전 서명은 두 경우 모두 보존한다 — 옛 목차와 새 조각이 섞이는 것을 막는 장치다', async () => {
    const bundled = await load();
    expect(bundled('s1a2b3c')).toMatch(/\/seoul\.pmtiles\?v=s1a2b3c$/);

    const external = await load('https://cdn.example/seoul.pmtiles');
    expect(external('s1a2b3c')).toBe('pmtiles://https://cdn.example/seoul.pmtiles?v=s1a2b3c');
  });

  it('끝 슬래시를 떼서 주소가 겹치지 않게 한다', async () => {
    const basemapTileUrl = await load('https://cdn.example/seoul.pmtiles/');
    expect(basemapTileUrl()).toBe('pmtiles://https://cdn.example/seoul.pmtiles');
  });
});
