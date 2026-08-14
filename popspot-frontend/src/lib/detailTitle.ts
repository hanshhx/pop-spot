/** 상세 검색 제목에 사용자가 찾는 정보(팝업·일정·위치)를 중복 없이 붙인다. */
export function popupDetailTitle(name: string): string {
  const clean = name.trim();
  if (!clean) return '서울 팝업 일정·위치';
  return /팝업(?:\s*스토어)?/.test(clean) ? `${clean} 일정·위치` : `${clean} 팝업 일정·위치`;
}
