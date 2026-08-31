/**
 * 검색에 열어도 되는 팝업 상세인가.
 *
 * <p><b>왜 전부 열지 않는가.</b> 살아 있는 팝업이 965개인데, 그중 주소가 "서울" 한 줄뿐인 것이
 * 191건(19.8%)이다. 그런 페이지는 이름과 날짜 말고 담을 것이 없다. 얇은 페이지를 대량으로
 * 색인시키면 사이트 전체 평가가 내려간다 — 페이지 수를 늘리려다 있던 순위까지 잃는다.
 *
 * <p><b>기준은 "검색한 사람의 질문에 답할 수 있는가" 다.</b> 실측 상위 검색어가 전부 "짱구 팝업",
 * "니케 팝업 위치", "코엑스 팝업" 형태다 — 사람들이 묻는 것은 <b>어디서 언제</b>다. 그 둘을 못
 * 채우는 페이지는 검색 결과에 뜰 자격이 없다.
 *
 * <p>이 판정은 <b>사이트맵과 noindex 양쪽이 같은 함수를 쓴다.</b> 두 곳이 어긋나면 크롤 예산만
 * 쓰고 색인은 안 되는 URL 이 생긴다(v2.42 에 실제로 겪은 사고다).
 */

import { groupSameEvent, type EventGroup, type GroupableEvent } from './groupSameEvent';

export type IndexableCandidate = {
  name?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

/** 판정 결과 — 왜 떨어졌는지 남긴다. 이유 없이 "안 됨" 만 알면 고칠 수가 없다. */
export type IndexVerdict = { ok: true } | { ok: false; reason: IndexRejectReason };

export type IndexRejectReason = 'NO_NAME' | 'NO_END_DATE' | 'ALREADY_ENDED' | 'VAGUE_LOCATION';

/**
 * 주소가 <b>실제로 찾아갈 수 있는</b> 수준인가.
 *
 * <p>번지·도로명·층처럼 숫자가 든 주소이거나, 구 이름이 있거나, 알려진 건물/상권 이름이 있으면
 * 통과. "서울" · "서울 강남" 처럼 동네만 있는 것은 떨어뜨린다 — 그 정보로는 아무도 못 간다.
 */
const HAS_NUMBER = /\d/;
const HAS_GU =
  /(종로|중|용산|성동|광진|동대문|중랑|성북|강북|도봉|노원|은평|서대문|마포|양천|강서|구로|금천|영등포|동작|관악|서초|강남|송파|강동)구/;
const HAS_VENUE =
  /(더현대|현대백화점|롯데백화점|롯데월드몰|신세계|갤러리아|AK플라자|타임스퀘어|코엑스|스타필드|아이파크몰|무신사|성수동|홍대|연남|한남|이태원|압구정|청담|가로수길|명동|을지로|여의도|잠실|건대|신촌|목동)/;

function hasUsefulLocation(location: string | null | undefined): boolean {
  const text = (location ?? '').trim();
  if (!text) return false;

  // 알려진 상권·건물 이름이면 길이를 따지지 않는다.
  //
  // <p>예전엔 길이 검사가 먼저였는데, {@link HAS_VENUE} 에 등록된 26개 중 <b>9개가 두 글자다</b>
  // (홍대·연남·한남·청담·명동·잠실·건대·신촌·목동). "서울 명동" 은 "서울" 을 떼면 두 글자라,
  // 명동을 유효 지명으로 <b>직접 등록해 뒀는데도</b> 그 앞의 길이 검사에서 잘렸다.
  //
  // <p>길이 검사의 목적은 "동네 이름조차 아닌 것" 을 걸러내는 것이었다. 그런데 실제 동네
  // 이름 상당수가 두 글자라, 걸러내려던 것보다 지키려던 것을 더 많이 잘랐다 — 2026-08-05
  // 실측으로 25건(명동 11·홍대 7·잠실 3·목동 2·신촌 2)이 이 순서 때문에 색인에서 빠져 있었다.
  if (HAS_VENUE.test(text)) return true;

  // 그 밖에는 "서울" 을 뗀 나머지가 세 글자는 돼야 한다. 목록에 없는 두 글자는 동네인지
  // 오타인지 구분할 방법이 없다.
  const rest = text.replace(/^서울\s*(특별시)?\s*/, '').trim();
  if (rest.length < 3) return false;
  return HAS_NUMBER.test(rest) || HAS_GU.test(text);
}

/**
 * @param today "YYYY-MM-DD". 호출부가 KST 기준으로 넘긴다 — 서버가 UTC 라 여기서 만들면 하루 어긋난다.
 */
export function judgeIndexable(m: IndexableCandidate, today: string): IndexVerdict {
  if (!m.name || !m.name.trim()) return { ok: false, reason: 'NO_NAME' };
  // 마감일이 없으면 "언제까지" 에 답할 수 없다. 검색한 사람이 제일 먼저 묻는 것이다.
  if (!m.endDate) return { ok: false, reason: 'NO_END_DATE' };
  // 끝난 팝업은 열지 않는다. 지금 갈 수 없는 곳을 검색 결과에 올리면 헛걸음을 만든다.
  if (m.endDate < today) return { ok: false, reason: 'ALREADY_ENDED' };
  if (!hasUsefulLocation(m.location)) return { ok: false, reason: 'VAGUE_LOCATION' };
  return { ok: true };
}

/** 판정만 필요할 때. */
export function isIndexableDetail(m: IndexableCandidate, today: string): boolean {
  return judgeIndexable(m, today).ok;
}

/**
 * 사이트맵에 실을 상세 <b>그룹</b>.
 *
 * <p><b>왜 묶는가.</b> 같은 행사가 출처마다 다른 이름·주소로 두 줄 이상 들어오는 일이 흔하다.
 * 랜딩({@code app/popups/[slug]/page.tsx})은 이미 {@link groupSameEvent} 로 묶어 <b>대표만</b>
 * 링크하는데, 사이트맵은 묶지 않고 전부 올렸다. 그래서 사이트가 크롤러에게 서로 다른 말을 했다 —
 * 목록에서는 한 곳인데 사이트맵에서는 두 곳이고, 두 URL 이 각자 자기를 canonical 이라 말한다.
 *
 * <p><b>순서가 전부다.</b> 색인 자격으로 <b>먼저</b> 거르고, 그 안에서 묶는다. 뒤집으면(묶고 나서
 * 대표만 판정) 대표가 자격 없는 그룹에서 <b>자격 있는 나머지 줄까지 통째로</b> 사라진다 —
 * 대표는 "주소가 가장 긴 것" 으로 뽑히지 색인 자격으로 뽑히지 않기 때문이다.
 *
 * <p>여기서 canonical 은 건드리지 않는다. 사이트맵에서 빼는 것은 되돌릴 수 있는 약한 신호지만,
 * canonical 을 남의 URL 로 돌리는 것은 <b>능동적인 색인 제거</b>다. 대표 선정 기준이 주소 문자열
 * 길이인 채로 그것까지 맡길 수는 없다.
 */
export function indexableDetailGroups<T extends GroupableEvent & IndexableCandidate>(
  live: T[],
  today: string,
): EventGroup<T>[] {
  return groupSameEvent(live.filter((m) => isIndexableDetail(m, today)));
}

/**
 * 실재하는 팝업 상세가 검색엔진에 줄 robots 값.
 *
 * <p><b>follow 는 자격과 무관하게 항상 열어 둔다.</b> {@code noindex} 는 "이 페이지를 검색 결과에
 * 올리지 마라" 이지 "여기서 더 가지 마라" 가 아니다. 둘을 같이 끄면 이 페이지 안의 '주변 팝업'
 * 링크가 크롤러에게 전달되지 않아, 상세끼리 이어지는 길이 통째로 끊긴다.
 *
 * <p>그 대가가 실측으로 보였다(2026-08-29). 팝업 1,463건 중 색인 자격은 465건인데 검색에 실제로
 * 나타난 상세는 <b>59개</b>뿐이었고, 구글은 <b>461개</b>를 "발견했지만 색인하지 않음" 으로 쥐고
 * 있었다. 자격 있는 상세로 가는 길의 상당수가 자격 없는 상세를 거쳐 가는데 그 길이 막혀 있었다.
 *
 * <p>영문·일문 상세는 {@code indexable} 이 무엇이든 색인하지 않는다(이름이 대부분 한국어 원문이라
 * 같은 내용이 세 벌 올라갈 뿐이다). 그 경우에도 이 함수를 {@code false} 로 부르면 길은 열린다 —
 * 그쪽 랜딩 176장씩이 상세로 링크하므로, 끊으면 그만큼이 막다른 골목이 된다.
 *
 * <p>숫자가 아닌 쓰레기 주소는 이 함수를 쓰지 마라. 그건 실재하는 팝업이 아니라서 따라갈 링크도 없다.
 */
export function detailRobots(indexable: boolean): { index: boolean; follow: boolean } {
  return { index: indexable, follow: true };
}
