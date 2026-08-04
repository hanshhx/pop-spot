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
  // "서울" 만 있거나 "서울 " 뒤가 두 글자 이하면 동네 이름조차 아니다.
  const rest = text.replace(/^서울\s*(특별시)?\s*/, '').trim();
  if (rest.length < 3) return false;
  return HAS_NUMBER.test(rest) || HAS_GU.test(text) || HAS_VENUE.test(text);
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
