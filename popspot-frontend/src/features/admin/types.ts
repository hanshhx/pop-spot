import type { useDashboardMetrics } from '@/components/admin/metrics/useDashboardMetrics';

/**
 * 관리자 화면이 쓰는 응답 타입.
 *
 * <p>백엔드 DTO 를 그대로 옮긴 게 아니라 <b>화면이 실제로 읽는 필드만</b> 적어 둔 것이다. 대부분
 * optional 인 이유도 그것이다 — 응답에 없으면 그 칸만 비면 되지, 화면이 죽으면 안 된다.
 *
 * <p>v2.53 — app/admin/page.tsx 가 1,744줄이라 탭 하나를 고칠 때마다 파일 전체를 건드려야 했다.
 * 동작은 그대로 두고 위치만 나눈다.
 */

export interface MetricData {
  time: string;
  cpu: number;
  memory: number;
}

export interface AdminStats {
  totalUsers?: number;
  totalPopups?: number;
  activePopups?: number;
  pendingPopups?: number;
  totalMatePosts?: number;
  pendingReview?: number;
  autoPublished?: number;
  todayStamps?: number;
}

export interface AdminMatePost {
  id: number;
  title: string;
  content?: string;
  author?: { nickname?: string };
  createdAt?: string;
  isMegaphone?: boolean;
}

export interface AdminUser {
  userId: string;
  email: string;
  nickname: string;
  picture?: string | null;
  provider?: string | null;
  role: string;
  createdAt?: string;
  isPremium?: boolean;
  premiumExpiryDate?: string | null;
  stampCount?: number;
  likeCount?: number;
}

export interface AdminVisitStats {
  todayVisitors: number;
  todayPageviews: number;
  todayGuests: number;
  todayMembers: number;
  weekVisitors: number;
  daily: { date: string; visitors: number }[];
  topPaths: { path: string; count: number }[];
}

/** 유입 경로 집계 1행. source 는 사람이 읽는 묶음명(네이버·구글·직접 방문…), host 는 원본 도메인. */
export interface AdminReferrer {
  source: string;
  host: string;
  visits: number;
}

/** 방문자 목록 1행. */
export interface AdminVisitor {
  visitorId: string;
  visits: number;
  paths: string;
  lastSeen: string;
  guest: boolean;
  userAgent: string | null;
}

/** 오늘 경로별 집계 1행. */
export interface AdminTodayPath {
  path: string;
  total: number;
  members: number;
  guests: number;
}

/** 라이브 댓글 1행. */
export interface AdminLiveComment {
  id: number;
  sender: string;
  message: string;
  sendTime?: string;
  popupName?: string;
}

/** 보상 지급 폼 상태. */
export interface RewardForm {
  nickname: string;
  itemType: string;
  amount: number;
}

/**
 * 통합 메트릭 훅의 반환값.
 *
 * <p>훅에서 직접 끌어와 <b>훅이 바뀌면 여기도 같이 깨지게</b> 둔다. 모양을 손으로 베껴 적으면
 * 한쪽만 바뀌었을 때 조용히 어긋난다.
 */
export type DashboardMetrics = ReturnType<
  typeof useDashboardMetrics<Record<string, number | string>>
>;
