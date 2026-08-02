import type { PopupStore } from '@/types/popup';

import type { AdminStats, AdminVisitStats } from './types';

/**
 * 로컬 미리보기용 목업 — 백엔드 없이 관리자 화면을 열어 볼 때만 쓴다.
 *
 * <p>실제로 쓰이는 조건은 {@code isPreviewEnv()} 가 참일 때(개발 빌드이거나 localhost)뿐이고,
 * 운영 도메인에서는 어떤 경로로도 여기 값이 화면에 오지 않는다.
 */

export const devAdminStats: AdminStats = {
  totalUsers: 22,
  activePopups: 134,
  pendingPopups: 3,
  totalMatePosts: 8,
  todayStamps: 12,
};

export const devPending: PopupStore[] = [
  {
    id: 5001,
    name: '성수 커피 팝업',
    location: '서울 성동구 성수동',
    status: 'PENDING',
    viewCount: 0,
    reporterId: 'user_88',
  },
  {
    id: 5002,
    name: '한남 브랜드전',
    location: '서울 용산구 한남동',
    status: 'PENDING',
    viewCount: 0,
    reporterId: 'user_12',
  },
  {
    id: 5003,
    name: '홍대 아트마켓',
    location: '서울 마포구 홍대',
    status: 'PENDING',
    viewCount: 0,
    reporterId: 'user_41',
  },
];

export const devVisitStats: AdminVisitStats = {
  todayVisitors: 87,
  todayPageviews: 312,
  todayGuests: 61,
  todayMembers: 26,
  weekVisitors: 540,
  daily: [
    { date: '07.04', visitors: 62 },
    { date: '07.05', visitors: 74 },
    { date: '07.06', visitors: 58 },
    { date: '07.07', visitors: 91 },
    { date: '07.08', visitors: 103 },
    { date: '07.09', visitors: 128 },
    { date: '07.10', visitors: 87 },
  ],
  topPaths: [
    { path: '/', count: 210 },
    { path: '/popup', count: 156 },
    { path: '/music', count: 44 },
  ],
};
