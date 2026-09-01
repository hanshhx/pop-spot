/**
 * 검색 결과 설명에 <b>어느 팝업을 적을지</b> 고르는 순서.
 *
 * <p>이 파일이 따로 있는 이유는 하나다 — 이 판정이 틀리면 <b>화면에는 아무 증상이 없다.</b>
 * 사이트는 멀쩡히 뜨고, 잘못된 문장은 우리가 보지 않는 검색 결과 안에서만 며칠씩 서 있는다.
 */

/** 마감일을 이미 판정해 둔 항목. {@code end} 가 {@code null} 이면 마감을 모르는 것. */
export type DatedEntry<T> = { item: T; end: Date | null };

/**
 * 설명에 넣을 순서로 정렬한다.
 *
 * <p><b>기본은 마감 임박순</b>이다. 목록 화면도 그 순서라, 설명에 적힌 팝업이 목록 맨 위에 있어야
 * 눌러 들어온 사람이 바로 찾는다. 순서를 따로 두면 그 연결이 끊긴다.
 *
 * <p><b>그런데 그 정렬을 그대로 쓰면 "가장 먼저 죽을 것"을 뽑는다.</b> 검색 결과의 설명은 우리가
 * 쓰는 순간이 아니라 <b>사용자가 보는 순간</b>에 판정되는데, 구글은 그 문장을 받아 두고 며칠씩
 * 보여 준다. 실측(2026-09-01)으로 {@code /popups/jamsil} 의 설명 첫 줄이 그날 마감인 팝업이었다.
 *
 * <p>그래서 {@code minDaysLeft} 미만만 <b>뒤로 미룬다.</b> 임박순은 그대로 지킨다 —
 * "오래 남은 순" 으로 뒤집으면 상설에 가까운 매장만 뽑혀, 설명이 밋밋해지고 누를 이유도 사라진다.
 *
 * <p>남은 것이 모자라면 임박한 것으로 채운다. 빈 설명보다는 곧 끝나는 팝업이라도 적는 편이 낫다.
 * 마감을 <b>모르는</b> 것은 언제나 맨 뒤다 — 설명에 마감이 안 붙어 누를 이유가 가장 약하다.
 */
export function orderForMetaDescription<T>(
  entries: DatedEntry<T>[],
  todayMs: number,
  minDaysLeft: number,
): DatedEntry<T>[] {
  const cutoff = todayMs + minDaysLeft * 24 * 60 * 60 * 1000;
  const sorted = [...entries].sort(
    (a, b) => (a.end?.getTime() ?? Infinity) - (b.end?.getTime() ?? Infinity),
  );

  const withEnd = sorted.filter((e): e is DatedEntry<T> & { end: Date } => e.end !== null);
  const noEnd = sorted.filter((e) => e.end === null);

  return [
    ...withEnd.filter((e) => e.end.getTime() >= cutoff),
    ...withEnd.filter((e) => e.end.getTime() < cutoff),
    ...noEnd,
  ];
}
