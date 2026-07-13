/** 마커 category(대문자 영문) → 한글 라벨. 미매핑은 원문 그대로. */
const CATEGORY_LABELS: Record<string, string> = {
  CHARACTER: "캐릭터",
  FASHION: "패션",
  BEAUTY: "뷰티",
  FOOD: "푸드",
  DESSERT: "푸드",
  ART: "문화",
  CULTURE: "문화",
  LIFESTYLE: "라이프스타일",
  TECH: "테크",
  ETC: "기타",
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "기타";
  return CATEGORY_LABELS[category.toUpperCase()] ?? category;
}

/** endDate 까지 남은 일수(오늘=0). 파싱 불가/없음이면 null. */
export function ddayCount(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const end = new Date(endDate.replace(/\./g, "-").slice(0, 10));
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((end.getTime() - startOfToday.getTime()) / 86_400_000);
}

/** "D-3" / "오늘 마감" / "종료" 배지 문구 + 강조 여부. */
export function ddayLabel(endDate: string | null | undefined): { text: string; urgent: boolean } | null {
  const d = ddayCount(endDate);
  if (d === null) return null;
  if (d < 0) return { text: "종료", urgent: false };
  if (d === 0) return { text: "오늘 마감", urgent: true };
  return { text: `D-${d}`, urgent: d <= 3 };
}

/** 위치 문자열을 짧게 (예: "서울 성동구 성수동" → "성동구"). 없으면 "위치 미정". */
export function regionShort(location: string | null | undefined): string {
  if (!location) return "위치 미정";
  const parts = location.trim().split(/\s+/);
  // "서울 XXX YYY" → XXX, "서울 XXX" → XXX, 그 외 → 앞 두 토큰
  if (parts[0] === "서울" && parts.length >= 2) return parts[1];
  return parts.slice(0, 2).join(" ");
}
