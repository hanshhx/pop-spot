/**
 * 하단 도크의 다섯 칸에 무엇이 들어가는지 정한다.
 *
 * <p>앞 네 칸은 고정이고, 다섯째 칸은 두 얼굴을 갖는다 — 평소에는 "더보기", 그 안의 탭
 * (음악·여권)을 보고 있을 때는 <b>그 탭</b>. 지금까지는 늘 "더보기" 라서, 음악 탭에 들어가도
 * 다섯째 칸에 라임만 켜지고 <b>무엇이 열려 있는지는 알 수 없었다.</b>
 *
 * <h3>앞 네 칸을 배열 순서로 자르면 안 된다</h3>
 *
 * <p>시안에는 {@code DOCK_ITEMS.slice(0, 4)} 라고 적혀 있다. 그런데 실제 배열은
 * 지도 · 코스 · <b>음악 · 여권</b> · 마이 · 메이트 순이라, 그대로 자르면 메이트 · 마이가 빠지고
 * 음악 · 여권이 앞으로 나온다 — <b>도크 순서가 바뀐다.</b>
 *
 * <p>그래서 앞 네 칸은 배열 순서가 아니라 <b>키 목록</b>으로 고른다. 배열({@code DOCK_ITEMS})은
 * 데스크탑 상단 네비게이션이 같이 쓰기 때문에 순서를 바꿀 수도 없다.
 */

export type DockKeyed = { key: string };

export type FifthSlot<T> = {
  /** 다섯째 칸에 보여줄 탭. {@code null} 이면 "더보기" 를 보여준다. */
  openItem: T | null;
  /** 지금 이 칸이 열려 있는 탭을 가리키고 있는가. {@code aria-current} 판단에 쓴다. */
  isCurrent: boolean;
  /** 이 칸 뒤에 다른 것이 더 있는가. 점 하나로 알린다. */
  hasMore: boolean;
};

export type DockSlots<T> = {
  primary: T[];
  secondary: T[];
  fifth: FifthSlot<T>;
};

/** 키 목록 순서대로 고른다. 없는 키는 조용히 건너뛴다 — 도크가 통째로 사라지는 것보다 낫다. */
function pick<T extends DockKeyed>(items: readonly T[], keys: readonly string[]): T[] {
  return keys.map((key) => items.find((item) => item.key === key)).filter((item): item is T => Boolean(item));
}

export function dockSlots<T extends DockKeyed>(
  items: readonly T[],
  primaryKeys: readonly string[],
  secondaryKeys: readonly string[],
  currentTab: string,
): DockSlots<T> {
  const primary = pick(items, primaryKeys);
  const secondary = pick(items, secondaryKeys);
  const openItem = secondary.find((item) => item.key === currentTab) ?? null;

  return {
    primary,
    secondary,
    fifth: {
      openItem,
      isCurrent: openItem !== null,
      // 탭 하나를 보여주는 중이라면, 이 칸에 다른 것이 더 있다는 사실이 가려진다. 그때만 알린다.
      hasMore: openItem !== null && secondary.length > 1,
    },
  };
}
