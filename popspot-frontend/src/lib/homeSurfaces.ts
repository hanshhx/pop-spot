import type { PopupStore } from '@/types/popup';

import { parseDate } from './popupSlices';

/**
 * 메인 화면에서 <b>겹치면 안 되는</b> 두 자리 — POP-LOOK(랭킹)과 게스트 히어로(마감 임박).
 *
 * <p>레일(30칸)은 여기 없다. 레일은 카테고리·정렬 칩으로 몇백 곳을 직접 훑는 브라우즈 자리라,
 * 고정 목록을 먹이면 그 힘이 죽는다 — 레일은 자기 상태(정렬·카테고리)로 따로 계산하고, 랭킹·
 * 마감임박과 겹쳐도 된다. 겹치면 안 되는 건 <b>가장 큰 두 자리, 랭킹과 마감 임박뿐</b>이다.
 */
export interface HomeSurfaces {
  /** POP-LOOK 대표 + 아래 목록 — 인기 랭킹. 여기가 유일한 랭킹이다. */
  ranking: PopupStore[];
  /** 게스트 히어로 2×2 — 마감 임박. */
  closing: PopupStore[];
}

/**
 * 풀에서 두 자리를 겹치지 않게 나눈다.
 *
 * <p><b>호출 순서가 곧 우선권이다.</b> {@code ranking} 이 먼저 집어가고 {@code closing} 은 그
 * 나머지에서 고른다 — 가장 큰 자리(POP-LOOK)가 먼저 먹는다. 풀이 모자라면 <b>칸을 채우려고
 * 같은 것을 두 번 넣지 않는다.</b> 채우다 만 목록을 그대로 돌려준다. 그러지 않으면 자리를
 * 나눈 의미가 없어지고, 고치려던 중복이 다른 이름으로 돌아온다.
 *
 * <p>두 정렬은 레일이 이미 쓰는 규칙과 같다({@code HomeClient.tsx} 의 {@code railPopups}) —
 * 여기서 새로 정의하지 않는다. {@code parseDate} 도 레일과 같은 것을 쓴다(달력 실재성 검증으로
 * 이월 방지).
 */
export function homeSurfaces(
  pool: PopupStore[],
  today: Date,
  sizes: { ranking: number; closing: number },
): HomeSurfaces {
  const used = new Set<number>();
  const take = (sorted: PopupStore[], n: number) => {
    const out: PopupStore[] = [];
    for (const item of sorted) {
      if (out.length >= n) break;
      if (used.has(item.id)) continue;
      used.add(item.id);
      out.push(item);
    }
    return out;
  };

  // 인기순 — viewCount desc, 동점은 id desc(새로 수집된 팝업을 먼저).
  const byPopular = [...pool].sort(
    (a, b) => (b.viewCount || 0) - (a.viewCount || 0) || b.id - a.id,
  );

  const endOf = (p: PopupStore) => parseDate(p.endDate)?.getTime() ?? Infinity;
  // 이미 끝난 것은 "마감 임박" 이 아니다 — today 를 받는 유일한 이유다.
  const byDeadline = pool
    .filter((p) => {
      const e = parseDate(p.endDate);
      return e ? e.getTime() >= today.getTime() : false;
    })
    .sort((a, b) => endOf(a) - endOf(b) || (b.viewCount || 0) - (a.viewCount || 0));

  return {
    ranking: take(byPopular, sizes.ranking),
    closing: take(byDeadline, sizes.closing),
  };
}
