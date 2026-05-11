/**
 * 사용자의 스탬프 누적 수로 등급을 결정한다.
 *
 *   0 ~ 2개   : NONE (등급 없음)
 *   3 ~ 5개   : 입문자 (Beginner)
 *   6 ~ 11개  : 헌터   (Hunter)
 *  12개 이상  : 마스터 (Master)
 *
 * 등급에 따라 프로필 아바타 테두리 색, 뱃지 색이 자동으로 바뀐다.
 */
export type RankKey = "MASTER" | "HUNTER" | "BEGINNER" | "NONE";

export interface UserRank {
  key: RankKey;
  /** 사용자에게 보여줄 한글 라벨 */
  label: string;
  /** 아바타/카드의 ring 클래스 — Tailwind ring-* 색상 */
  ring: string;
  /** 강조 텍스트 색 */
  text: string;
  /** 배경 그라데이션 (등급 카드용) */
  bg: string;
  /** 진행도 표시용 색 */
  accent: string;
  /** 다음 등급까지 필요한 스탬프 수 (마스터면 0) */
  toNext: number;
  /** 다음 등급 라벨 (마스터면 빈 문자열) */
  nextLabel: string;
}

export function getUserRank(stampCount: number | null | undefined): UserRank {
  const stamps = stampCount ?? 0;

  if (stamps >= 12) {
    return {
      key: "MASTER",
      label: "팝업 마스터",
      ring: "ring-amber-400",
      text: "text-amber-500 dark:text-amber-300",
      bg: "from-amber-300/30 via-orange-300/20 to-yellow-200/30",
      accent: "bg-amber-400",
      toNext: 0,
      nextLabel: "",
    };
  }

  if (stamps >= 6) {
    return {
      key: "HUNTER",
      label: "팝업 헌터",
      ring: "ring-lime-400",
      text: "text-lime-600 dark:text-lime-300",
      bg: "from-lime-300/25 via-emerald-300/15 to-sky-300/20",
      accent: "bg-lime-400",
      toNext: 12 - stamps,
      nextLabel: "팝업 마스터",
    };
  }

  if (stamps >= 3) {
    return {
      key: "BEGINNER",
      label: "팝업 입문자",
      ring: "ring-cyan-400",
      text: "text-cyan-600 dark:text-cyan-300",
      bg: "from-cyan-300/20 via-sky-300/15 to-blue-300/20",
      accent: "bg-cyan-400",
      toNext: 6 - stamps,
      nextLabel: "팝업 헌터",
    };
  }

  return {
    key: "NONE",
    label: "기록 시작",
    ring: "ring-foreground/15",
    text: "text-muted-foreground",
    bg: "from-foreground/5 to-foreground/0",
    accent: "bg-foreground/30",
    toNext: 3 - stamps,
    nextLabel: "팝업 입문자",
  };
}
