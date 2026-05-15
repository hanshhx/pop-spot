/**
 * 사용자의 스탬프 누적 수로 등급을 결정한다.
 *
 * <ul>
 *   <li>0 ~ 2개  : NONE (등급 없음)
 *   <li>3 ~ 5개  : 입문자 (BEGINNER)
 *   <li>6 ~ 11개 : 헌터   (HUNTER)
 *   <li>12개 이상 : 마스터 (MASTER)
 * </ul>
 *
 * 등급에 따라 프로필 아바타 테두리 색 / 뱃지 색이 자동으로 바뀐다.
 */
export type RankKey = 'MASTER' | 'HUNTER' | 'BEGINNER' | 'NONE';

export interface UserRank {
  key: RankKey;
  /** 사용자에게 보여줄 한글 라벨. */
  label: string;
  /** 아바타/카드의 ring 클래스 — Tailwind `ring-*` 색상. */
  ring: string;
  /** 강조 텍스트 색 (라이트/다크 모드 모두). */
  text: string;
  /** 등급 카드 배경 그라데이션. */
  bg: string;
  /** 진행도 미터 색 (Tailwind bg-*). */
  accent: string;
  /** 다음 등급까지 남은 스탬프 수 (마스터면 0). */
  toNext: number;
  /** 다음 등급 라벨 (마스터면 빈 문자열). */
  nextLabel: string;
}

/* ============================== 임계값 ============================== */

const BEGINNER_MIN = 3;
const HUNTER_MIN = 6;
const MASTER_MIN = 12;

/* ============================== 등급 정의 ============================== */

const MASTER_RANK: UserRank = {
  key: 'MASTER',
  label: '팝업 마스터',
  ring: 'ring-amber-400',
  text: 'text-amber-500 dark:text-amber-300',
  bg: 'from-amber-300/30 via-orange-300/20 to-yellow-200/30',
  accent: 'bg-amber-400',
  toNext: 0,
  nextLabel: '',
};

const HUNTER_RING = 'ring-lime-400';
const HUNTER_TEXT = 'text-lime-600 dark:text-lime-300';
const HUNTER_BG = 'from-lime-300/25 via-emerald-300/15 to-sky-300/20';
const HUNTER_ACCENT = 'bg-lime-400';

const BEGINNER_RING = 'ring-cyan-400';
const BEGINNER_TEXT = 'text-cyan-600 dark:text-cyan-300';
const BEGINNER_BG = 'from-cyan-300/20 via-sky-300/15 to-blue-300/20';
const BEGINNER_ACCENT = 'bg-cyan-400';

/* ============================== Public API ============================== */

export function getUserRank(stampCount: number | null | undefined): UserRank {
  const stamps = stampCount ?? 0;

  if (stamps >= MASTER_MIN) return MASTER_RANK;
  if (stamps >= HUNTER_MIN) return buildHunter(stamps);
  if (stamps >= BEGINNER_MIN) return buildBeginner(stamps);
  return buildNone(stamps);
}

/* ============================== 내부 빌더 ============================== */

const buildHunter = (stamps: number): UserRank => ({
  key: 'HUNTER',
  label: '팝업 헌터',
  ring: HUNTER_RING,
  text: HUNTER_TEXT,
  bg: HUNTER_BG,
  accent: HUNTER_ACCENT,
  toNext: MASTER_MIN - stamps,
  nextLabel: '팝업 마스터',
});

const buildBeginner = (stamps: number): UserRank => ({
  key: 'BEGINNER',
  label: '팝업 입문자',
  ring: BEGINNER_RING,
  text: BEGINNER_TEXT,
  bg: BEGINNER_BG,
  accent: BEGINNER_ACCENT,
  toNext: HUNTER_MIN - stamps,
  nextLabel: '팝업 헌터',
});

const buildNone = (stamps: number): UserRank => ({
  key: 'NONE',
  label: '기록 시작',
  ring: 'ring-foreground/15',
  text: 'text-muted-foreground',
  bg: 'from-foreground/5 to-foreground/0',
  accent: 'bg-foreground/30',
  toNext: BEGINNER_MIN - stamps,
  nextLabel: '팝업 입문자',
});
