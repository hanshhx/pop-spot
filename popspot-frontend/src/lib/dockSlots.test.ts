import { describe, expect, it } from 'vitest';

import { dockSlots } from './dockSlots';
import { DOCK_ITEMS } from '@/components/layout/BottomDock';

/** 실제 배열 순서 그대로. 이 순서가 곧 시안 코드의 함정이다. */
const ITEMS = [
  { key: 'MAP' },
  { key: 'COURSE' },
  { key: 'MUSIC' },
  { key: 'PASSPORT' },
  { key: 'MY' },
  { key: 'MATE' },
];

const PRIMARY = ['MAP', 'COURSE', 'MATE', 'MY'];
const SECONDARY = ['MUSIC', 'PASSPORT'];

describe('앞 네 칸', () => {
  it('배열 순서가 아니라 키 목록 순서를 따른다', () => {
    // 이 시험이 이 파일의 존재 이유다.
    // 시안의 DOCK_ITEMS.slice(0, 4) 는 지도·코스·음악·여권을 준다 — 도크 순서가 바뀐다.
    const { primary } = dockSlots(ITEMS, PRIMARY, SECONDARY, 'MAP');
    expect(primary.map((i) => i.key)).toEqual(['MAP', 'COURSE', 'MATE', 'MY']);
    expect(primary.map((i) => i.key)).not.toEqual(ITEMS.slice(0, 4).map((i) => i.key));
  });

  it('없는 키는 건너뛴다 — 도크를 통째로 잃지 않는다', () => {
    const { primary } = dockSlots(ITEMS, ['MAP', 'GHOST', 'MY'], SECONDARY, 'MAP');
    expect(primary.map((i) => i.key)).toEqual(['MAP', 'MY']);
  });
});

describe('다섯째 칸', () => {
  it('앞 네 칸 중 하나를 보고 있으면 "더보기" 다', () => {
    const { fifth } = dockSlots(ITEMS, PRIMARY, SECONDARY, 'MAP');
    expect(fifth.openItem).toBeNull();
    expect(fifth.isCurrent).toBe(false);
    expect(fifth.hasMore).toBe(false);
  });

  it('음악을 보고 있으면 음악을 보여준다', () => {
    // 예전에는 여기가 늘 "더보기" 라, 라임만 켜지고 무엇이 열렸는지는 알 수 없었다.
    const { fifth } = dockSlots(ITEMS, PRIMARY, SECONDARY, 'MUSIC');
    expect(fifth.openItem?.key).toBe('MUSIC');
    expect(fifth.isCurrent).toBe(true);
  });

  it('여권도 마찬가지다', () => {
    const { fifth } = dockSlots(ITEMS, PRIMARY, SECONDARY, 'PASSPORT');
    expect(fifth.openItem?.key).toBe('PASSPORT');
  });

  it('탭을 보여줄 때는 뒤에 더 있다는 것을 알린다', () => {
    // 음악이 보이는 동안 여권으로 가는 길이 화면에서 사라진다. 점 하나로 남긴다.
    expect(dockSlots(ITEMS, PRIMARY, SECONDARY, 'MUSIC').fifth.hasMore).toBe(true);
  });

  it('숨은 탭이 하나뿐이면 알릴 것이 없다', () => {
    // 점은 "더 있다" 는 뜻이다. 그것뿐이면 거짓말이 된다.
    expect(dockSlots(ITEMS, PRIMARY, ['MUSIC'], 'MUSIC').fifth.hasMore).toBe(false);
  });

  it('앞 네 칸에 있는 탭은 다섯째 칸이 가져가지 않는다', () => {
    // MY 는 앞 칸에 있다. 다섯째 칸까지 같이 켜지면 활성 표시가 두 개가 된다.
    expect(dockSlots(ITEMS, PRIMARY, SECONDARY, 'MY').fifth.openItem).toBeNull();
  });
});

describe('실제 DOCK_ITEMS', () => {
  it('키 목록에 적힌 탭이 배열에 다 있다', () => {
    // 배열에서 탭 하나를 지우면 도크에서 조용히 사라진다 — 오류가 나지 않는다.
    const keys = DOCK_ITEMS.map((i) => i.key);
    for (const key of [...PRIMARY, ...SECONDARY]) expect(keys).toContain(key);
  });

  it('배열 앞 네 개는 여전히 표시 순서와 다르다', () => {
    // 언젠가 배열 순서가 표시 순서와 같아지면 slice(0,4) 가 우연히 맞게 되고,
    // 그때 누군가 그렇게 고쳐 쓸 것이다. 그 전에 이 시험이 먼저 깨져서 알려준다.
    expect(DOCK_ITEMS.slice(0, 4).map((i) => i.key)).not.toEqual(PRIMARY);
  });
});
