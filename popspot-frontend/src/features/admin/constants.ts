import {
  Activity,
  AlertCircle,
  BarChart3,
  Footprints,
  Globe,
  Inbox,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';

/**
 * 관리자 화면의 고정 값 — 폴링 주기와 좌측 메뉴.
 *
 * <p>v2.53 — app/admin/page.tsx 에서 분리했다. 값과 순서는 그대로다.
 */

// 실시간 폴링 — 3초 주기. 더 잦으면 백엔드 부하, 더 느슨하면 모니터링 가치 떨어짐.
export const SERVER_METRICS_POLL_INTERVAL_MS = 3000;
export const SERVER_METRICS_BUFFER_SIZE = 15;

/**
 * 번역 백필 진행 확인 — 5초 주기로 최대 20분.
 *
 * 지표 폴링(3초)보다 느슨한 이유는 한 배치가 수십 초 단위라 더 자주 물어도 같은 숫자만
 * 돌아오기 때문이다. 20분을 넘겨도 작업은 서버에서 계속된다 — 화면만 그만 따라간다.
 */
export const TRANSLATION_POLL_MS = 5000;
export const TRANSLATION_MAX_POLLS = 240;

/**
 * 좌측 사이드바 네비게이션 — 개선안 #7: 상단 가로 탭 + "MASTER ADMIN" 해커 터미널 톤 대신
 * 소비자 앱과 같은 디자인 시스템의 밝은 사이드바. 서비스 운영 항목이 위, 시스템은 맨 아래.
 */
export const NAV: { id: string; label: string; icon: typeof Users; badge?: boolean }[] = [
  { id: 'DASHBOARD', label: '대시보드', icon: BarChart3 },
  { id: 'POPUPS', label: '팝업 관리', icon: Store },
  { id: 'PENDING', label: '제보 승인', icon: AlertCircle, badge: true },
  { id: 'MEMBERS', label: '회원', icon: Users },
  { id: 'MATES', label: '커뮤니티', icon: MessageSquare },
  { id: 'COMMENTS', label: '라이브 댓글', icon: MessageSquare },
  { id: 'VISITS', label: '방문 통계', icon: Globe },
  { id: 'VISITORS', label: '방문자', icon: Footprints },
  { id: 'FEEDBACK', label: '의견', icon: Inbox },
  { id: 'AUDIT', label: '감사 로그', icon: ShieldAlert },
  { id: 'SEASON', label: '계절 테마', icon: Sparkles },
  { id: 'SYSTEM', label: '시스템', icon: Activity },
];

export const TAB_TITLE: Record<string, string> = {
  DASHBOARD: '서비스 대시보드',
  POPUPS: '팝업 관리',
  PENDING: '제보 승인',
  MEMBERS: '회원',
  MATES: '커뮤니티 관리',
  COMMENTS: '라이브 댓글 관리',
  VISITS: '방문 통계',
  VISITORS: '방문자 목록',
  FEEDBACK: '의견',
  AUDIT: '관리자 행위 기록',
  SEASON: '계절 테마',
  SYSTEM: '시스템',
};
