/**
 * 동행 게시판 상단 부스트 — 등급별 월 한도 정의.
 *
 * <p>백엔드 {@code BoostPolicy.java} 와 임계값 / 한도가 일치해야 한다. 한쪽만 바꾸면
 * 사용자가 보는 잔여 횟수와 서버가 차감하는 한도가 어긋난다.
 */

import type { RankKey } from './rank';

export const BOOST_LIMIT_BY_RANK: Record<RankKey, number> = {
  MASTER: 5,
  HUNTER: 3,
  BEGINNER: 1,
  NONE: 0,
};

/** 등급별 한도 안내 라벨 — 글쓰기 모달에서 사용자 친화적으로 보여주기. */
export const BOOST_LIMIT_HINT: Record<RankKey, string> = {
  MASTER: '팝업 마스터: 월 5회',
  HUNTER: '팝업 헌터: 월 3회',
  BEGINNER: '팝업 입문자: 월 1회',
  NONE: '입문자 등급 도달 후 사용 가능',
};

/** 백엔드 {@code GET /api/mates/boost-status} 응답 모양. */
export interface BoostStatus {
  /** "MASTER" / "HUNTER" / "BEGINNER" / "NONE" */
  rank: RankKey;
  monthlyLimit: number;
  used: number;
  remaining: number;
}
