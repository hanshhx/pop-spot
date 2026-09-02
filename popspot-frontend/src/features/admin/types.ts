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
  /**
   * 가려진 이메일 (`ho****@naver.com`).
   *
   * <p>이름이 `email` 이 아닌 이유 — 이 값은 진짜 주소가 아니다. `email` 로 두면 다음 사람이
   * 그대로 메일 발송이나 대조에 쓴다. 전체 주소가 필요하면 해제 버튼을 눌러 받는다.
   */
  emailMasked: string | null;
  nickname: string;
  provider?: string | null;
  role: string;
  createdAt?: string;
  isPremium?: boolean;
  premiumExpiryDate?: string | null;
}

export interface AdminVisitStats {
  todayVisitors: number;
  todayPageviews: number;
  todayGuests: number;
  todayMembers: number;
  weekVisitors: number;
  daily: { date: string; visitors: number }[];
  topPaths: { path: string; count: number }[];
  /**
   * 가장 최근 방문 기록 시각(ISO).
   *
   * <p>선택 사항인 이유 — 백엔드 jar 는 손으로 올리므로, 프론트가 먼저 배포되는 구간이 반드시
   * 생긴다. 그때 이 값이 없다고 화면이 깨지거나 없는 경보를 울리면 안 된다.
   */
  lastVisitAt?: string | null;
  /** 시각별 하루 평균 방문 수. 공백을 평소치와 견주는 데 쓴다. */
  hourlyAverage?: { hour: number; perDay: number }[];
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
  /** 다녀간 경로 목록(쉼표 구분). 봇 판정과 이탈 지점 파악에 실제로 쓰인다. */
  paths: string | null;
  /** 서로 다른 경로의 개수. 한눈에 보라고 함께 준다. */
  pathCount: number;
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

/**
 * 통합 메트릭 훅의 반환값.
 *
 * <p>훅에서 직접 끌어와 <b>훅이 바뀌면 여기도 같이 깨지게</b> 둔다. 모양을 손으로 베껴 적으면
 * 한쪽만 바뀌었을 때 조용히 어긋난다.
 */
export type DashboardMetrics = ReturnType<
  typeof useDashboardMetrics<Record<string, number | string>>
>;

/**
 * 운영 서버(VM)의 현재 자원 — 시계열이 아니라 <b>지금 값</b>이다.
 *
 * <p>총량과 디스크는 3초마다 바뀌지 않으므로 차트에 넣지 않는다. {@link MetricData} 는 그리는 값,
 * 이쪽은 옆에 숫자로 보여 주는 값이다.
 */
export interface ServerResource {
  /** OS 물리 메모리(MB). */
  memoryUsedMb: number;
  memoryTotalMb: number;
  /** 업로드가 쌓이는 파일시스템(GB). */
  diskUsedGb: number;
  diskTotalGb: number;
  /** JVM 힙(MB) — 서버 메모리와 다르다. 자바 쪽 누수를 보는 값. */
  heapUsedMb: number;
  heapMaxMb: number;
}
