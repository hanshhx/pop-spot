/**
 * 의견 보내기 도메인 공용 타입.
 *
 * <p>백엔드 {@code FeedbackResponseDto / FeedbackCreateRequestDto / FeedbackReplyRequestDto}
 * 와 1:1 대응. 카테고리 / 상태는 화이트리스트라 union 으로 좁혀 둔다.
 */

export type FeedbackCategory = 'BUG' | 'FEATURE' | 'GOOD' | 'OTHER';

export type FeedbackStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'WONT_FIX';

export interface Feedback {
  id: number;
  userId: string | null;
  guestEmail: string | null;
  category: FeedbackCategory;
  title: string;
  content: string;
  status: FeedbackStatus;
  adminReply: string | null;
  createdAt: string;
  repliedAt: string | null;
}

export interface FeedbackCreatePayload {
  category: FeedbackCategory;
  title: string;
  content: string;
  guestEmail?: string;
}

export interface FeedbackReplyPayload {
  adminReply?: string;
  status: FeedbackStatus;
}

export interface FeedbackStatusCounts {
  PENDING: number;
  REVIEWING: number;
  RESOLVED: number;
  WONT_FIX: number;
}

/** 카테고리 표시 라벨. UI 에서 이 매핑만 보면 됨 — 한 곳에서 관리. */
export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  BUG: '버그',
  FEATURE: '기능 제안',
  GOOD: '좋은 점',
  OTHER: '그 외',
};

/** 상태 표시 라벨. */
export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  PENDING: '확인 대기',
  REVIEWING: '검토 중',
  RESOLVED: '처리 완료',
  WONT_FIX: '반영 안함',
};
