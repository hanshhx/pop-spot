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
  /**
   * 영어·일본어 라벨 — 표시명을 사전이 아니라 <b>정의에 붙인다</b>(regions.ts 와 같은 방식).
   *
   * <p>사전(i18n.tsx)은 브라우저의 언어 상태에 기대는 훅이라 훅이 없는 곳에서는 읽을 수 없는데,
   * 이 파일은 순수 계산이라 그런 곳에서도 불린다. 등급은 네 개뿐이라 손으로 정확히 넣을 수 있다.
   *
   * <p>꺼낼 때는 {@code localizedLabel(rank, locale)} 을 쓴다.
   */
  labelEn: string;
  labelJa: string;
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
  /** 다음 등급의 영어·일본어 라벨. {@link nextRankLabels} 로 묶어서 꺼낸다. */
  nextLabelEn: string;
  nextLabelJa: string;
}

/* ============================== 임계값 ============================== */

const BEGINNER_MIN = 3;
const HUNTER_MIN = 6;
const MASTER_MIN = 12;

/* ============================== 등급 정의 ============================== */

// 등급 이름은 세 언어 모두 같은 사다리로 읽혀야 한다 — 한 단계씩 올라가는 이름인 걸 알 수 있어야
// 진행도 막대가 뜻을 갖는다. 그래서 일본어는 한자(入門者)를 섞지 않고 카타카나로 맞췄다.
// 라벨을 상수로 뽑은 것도 같은 이유다. 다음 등급 라벨이 같은 값을 참조하므로 이름을 고쳐도 어긋나지 않는다.

const MASTER_LABEL_KO = '팝업 마스터';
const MASTER_LABEL_EN = 'Pop-up Master';
const MASTER_LABEL_JA = 'ポップアップマスター';

const HUNTER_LABEL_KO = '팝업 헌터';
const HUNTER_LABEL_EN = 'Pop-up Hunter';
const HUNTER_LABEL_JA = 'ポップアップハンター';

const BEGINNER_LABEL_KO = '팝업 입문자';
const BEGINNER_LABEL_EN = 'Pop-up Rookie';
const BEGINNER_LABEL_JA = 'ポップアップビギナー';

const MASTER_RANK: UserRank = {
  key: 'MASTER',
  label: MASTER_LABEL_KO,
  labelEn: MASTER_LABEL_EN,
  labelJa: MASTER_LABEL_JA,
  ring: 'ring-amber-400',
  text: 'text-amber-500 dark:text-amber-300',
  bg: 'from-amber-300/30 via-orange-300/20 to-yellow-200/30',
  accent: 'bg-amber-400',
  toNext: 0,
  nextLabel: '',
  nextLabelEn: '',
  nextLabelJa: '',
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

/**
 * 다음 등급 라벨을 {@code localizedLabel} 이 받는 모양으로 묶어 준다.
 *
 * <p>다음 등급은 이름만 필요해 색·임계값까지 든 {@link UserRank} 를 통째로 담지 않았는데, 그 탓에
 * 세 언어가 평평한 필드로 흩어져 있다. 부르는 쪽마다 객체를 다시 조립하면 한 언어를 빠뜨리기 쉬워
 * 여기서 한 번만 맞춘다.
 */
export function nextRankLabels(rank: UserRank): {
  label: string;
  labelEn: string;
  labelJa: string;
} {
  return { label: rank.nextLabel, labelEn: rank.nextLabelEn, labelJa: rank.nextLabelJa };
}

/* ============================== 내부 빌더 ============================== */

const buildHunter = (stamps: number): UserRank => ({
  key: 'HUNTER',
  label: HUNTER_LABEL_KO,
  labelEn: HUNTER_LABEL_EN,
  labelJa: HUNTER_LABEL_JA,
  ring: HUNTER_RING,
  text: HUNTER_TEXT,
  bg: HUNTER_BG,
  accent: HUNTER_ACCENT,
  toNext: MASTER_MIN - stamps,
  nextLabel: MASTER_LABEL_KO,
  nextLabelEn: MASTER_LABEL_EN,
  nextLabelJa: MASTER_LABEL_JA,
});

const buildBeginner = (stamps: number): UserRank => ({
  key: 'BEGINNER',
  label: BEGINNER_LABEL_KO,
  labelEn: BEGINNER_LABEL_EN,
  labelJa: BEGINNER_LABEL_JA,
  ring: BEGINNER_RING,
  text: BEGINNER_TEXT,
  bg: BEGINNER_BG,
  accent: BEGINNER_ACCENT,
  toNext: HUNTER_MIN - stamps,
  nextLabel: HUNTER_LABEL_KO,
  nextLabelEn: HUNTER_LABEL_EN,
  nextLabelJa: HUNTER_LABEL_JA,
});

const buildNone = (stamps: number): UserRank => ({
  key: 'NONE',
  label: '기록 시작',
  labelEn: 'Getting started',
  labelJa: '記録スタート',
  ring: 'ring-foreground/15',
  text: 'text-muted-foreground',
  bg: 'from-foreground/5 to-foreground/0',
  accent: 'bg-foreground/30',
  toNext: BEGINNER_MIN - stamps,
  nextLabel: BEGINNER_LABEL_KO,
  nextLabelEn: BEGINNER_LABEL_EN,
  nextLabelJa: BEGINNER_LABEL_JA,
});
