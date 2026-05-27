/**
 * v2.21 — 시점 / 카테고리 슬라이싱 유틸. 메인 BROWSE 섹션 및 SEO 랜딩 페이지에서 공통 사용.
 *
 * <p>모든 함수는 순수 — 입력 배열만으로 결과 도출, 외부 호출 없음. 시점 판정은 클라이언트
 * 로컬 시간 기준 (KST 사용자 가정).
 */

export type PeriodCode = "today" | "tomorrow" | "this-week" | "this-weekend" | "this-month";

export type PeriodDef = {
  code: PeriodCode;
  label: string;
  slug: string;
};

export const PERIODS: PeriodDef[] = [
  { code: "today", label: "오늘", slug: "today" },
  { code: "tomorrow", label: "내일", slug: "tomorrow" },
  { code: "this-week", label: "이번 주", slug: "this-week" },
  { code: "this-weekend", label: "주말", slug: "this-weekend" },
  { code: "this-month", label: "이번 달", slug: "this-month" },
];

export type CategoryCode =
  | "fashion"
  | "beauty"
  | "character"
  | "dessert"
  | "lifestyle"
  | "art"
  | "tech"
  | "other";

export type CategoryDef = {
  code: CategoryCode;
  label: string;
  slug: string;
  /** 한국어 카테고리 원문 매칭 키워드. 백엔드 category 필드가 자유 텍스트라 substring 매칭. */
  keywords: string[];
};

export const CATEGORIES: CategoryDef[] = [
  {
    code: "fashion",
    label: "패션",
    slug: "fashion",
    keywords: ["패션", "의류", "잡화", "fashion"],
  },
  {
    code: "beauty",
    label: "뷰티",
    slug: "beauty",
    keywords: ["뷰티", "화장품", "코스메틱", "beauty"],
  },
  {
    code: "character",
    label: "캐릭터",
    slug: "character",
    keywords: ["캐릭터", "굿즈", "애니", "character"],
  },
  {
    code: "dessert",
    label: "디저트",
    slug: "dessert",
    keywords: ["디저트", "베이커리", "카페", "푸드", "음료", "dessert"],
  },
  {
    code: "lifestyle",
    label: "라이프",
    slug: "lifestyle",
    keywords: ["라이프", "리빙", "홈", "lifestyle"],
  },
  {
    code: "art",
    label: "아트",
    slug: "art",
    keywords: ["아트", "전시", "갤러리", "art"],
  },
  {
    code: "tech",
    label: "테크",
    slug: "tech",
    keywords: ["테크", "전자", "IT", "tech"],
  },
];

/* ============================== 시점 ============================== */

/** ISO yyyy-MM-dd 또는 yyyy.MM.dd 또는 null 안전 파싱. */
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const normalized = s.trim().replace(/\./g, "-").slice(0, 10);
  const parts = normalized.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 팝업이 특정 날짜에 열려있나? start ≤ date ≤ end. */
function isOpenOn(start: Date | null, end: Date | null, date: Date): boolean {
  if (!start || !end) return false;
  const t = date.getTime();
  return start.getTime() <= t && t <= end.getTime();
}

/** 어느 시점 슬라이스에 속하는지. 여러 슬라이스에 동시에 포함될 수 있음 (오늘 = 이번 주 = 이번 달). */
export function matchesPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  period: PeriodCode,
  now: Date = new Date(),
): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return false;

  const today = startOfDay(now);
  const day = today.getDay(); // 0 일 ~ 6 토

  switch (period) {
    case "today":
      return isOpenOn(start, end, today);
    case "tomorrow": {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      return isOpenOn(start, end, t);
    }
    case "this-week": {
      // 월요일 ~ 일요일 범위 중 단 하루라도 겹치면 매치.
      const weekStart = new Date(today);
      const offsetToMon = (day + 6) % 7; // 일=0 → 6, 월=1 → 0
      weekStart.setDate(weekStart.getDate() - offsetToMon);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return start <= weekEnd && end >= weekStart;
    }
    case "this-weekend": {
      // 토~일 두 날 중 하나라도 열리면.
      const weekStart = new Date(today);
      const offsetToSat = (6 - day + 7) % 7;
      weekStart.setDate(weekStart.getDate() + offsetToSat);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 1);
      return start <= weekEnd && end >= weekStart;
    }
    case "this-month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return start <= monthEnd && end >= monthStart;
    }
  }
}

/* ============================== 카테고리 ============================== */

export function classifyCategory(category: string | null | undefined): CategoryCode {
  if (!category) return "other";
  const text = category.trim().toLowerCase();
  if (!text) return "other";

  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (text.includes(kw.toLowerCase())) return cat.code;
    }
  }
  return "other";
}

export function categoryLabel(code: CategoryCode): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? "기타";
}

export function categoryBySlug(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function periodBySlug(slug: string): PeriodDef | undefined {
  return PERIODS.find((p) => p.slug === slug);
}
