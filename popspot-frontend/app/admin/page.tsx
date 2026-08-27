'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogOut } from 'lucide-react';
import Swal from 'sweetalert2';

import { apiFetch } from '../../src/lib/api';
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify';
import { clearAuthToken } from '@/lib/authStorage';
import type { PopupStore } from '@/types/popup';
import {
  useDashboardMetrics,
  type DashboardSnapshot,
} from '@/components/admin/metrics/useDashboardMetrics';

import { DashboardTab } from '@/features/admin/tabs/DashboardTab';
import { PendingTab } from '@/features/admin/tabs/PendingTab';
import { PopupsTab } from '@/features/admin/tabs/PopupsTab';
import { MatesTab } from '@/features/admin/tabs/MatesTab';
import { CommentsTab } from '@/features/admin/tabs/CommentsTab';
import { MembersTab } from '@/features/admin/tabs/MembersTab';
import { VisitsTab } from '@/features/admin/tabs/VisitsTab';
import { VisitorsTab } from '@/features/admin/tabs/VisitorsTab';
import { AuditTab } from '@/features/admin/tabs/AuditTab';
import { ReauthGate } from '@/features/admin/ReauthGate';
import { FeedbackTab } from '@/features/admin/tabs/FeedbackTab';
import { SystemTab } from '@/features/admin/tabs/SystemTab';
import {
  NAV,
  SERVER_METRICS_BUFFER_SIZE,
  SERVER_METRICS_POLL_INTERVAL_MS,
  TAB_TITLE,
  TRANSLATION_MAX_POLLS,
  TRANSLATION_POLL_MS,
} from '@/features/admin/constants';
import { devAdminStats, devPending, devVisitStats } from '@/features/admin/devData';
import { isPreviewEnv, toLinePoint, uaLooksBot } from '@/features/admin/helpers';
import type {
  AdminMatePost,
  AdminReferrer,
  AdminStats,
  AdminTodayPath,
  AdminUser,
  AdminVisitStats,
  MetricData,
  ServerResource,
} from '@/features/admin/types';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [isLoading, setIsLoading] = useState(true);
  // 불러오기 실패를 '데이터 없음' 으로 보여 주지 않기 위한 상태. 예전엔 회원 목록 조회가
  // 실패해도 '회원 0명 / 아직 가입한 회원이 없습니다' 가 떴다.
  const [loadError, setLoadError] = useState<string | null>(null);

  /*
   * v2.13.3 — role 게이트. 일반 유저가 /admin 에 오면 polling/SSE 가 403 도배를 일으켜
   * mount 시점에 role 을 검사해 ADMIN 이 아니면 리다이렉트한다. 서버 권한은 토큰으로 별도 강제.
   * [redesign/test] 로컬(백엔드 없음)에서는 미리보기를 위해 게이트를 통과시킨다(프로덕션 무관).
   */
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('user');
      if (!raw) {
        if (isPreviewEnv()) {
          setAuthorized(true);
          return;
        }
        router.replace('/login');
        return;
      }
      const parsed = JSON.parse(raw) as { role?: string };
      const role = (parsed.role ?? '').trim().toUpperCase();
      const isAdmin = role === 'ROLE_ADMIN' || role === 'ADMIN';
      if (!isAdmin) {
        if (isPreviewEnv()) {
          setAuthorized(true);
          return;
        }
        router.replace('/');
        return;
      }
      setAuthorized(true);
    } catch {
      if (isPreviewEnv()) {
        setAuthorized(true);
        return;
      }
      router.replace('/login');
    }
  }, [router]);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingPopups, setPendingPopups] = useState<PopupStore[]>([]);
  const [allPopups, setAllPopups] = useState<PopupStore[]>([]);
  const [matePosts, setMatePosts] = useState<AdminMatePost[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [visitStats, setVisitStats] = useState<AdminVisitStats | null>(null);
  const [todayPaths, setTodayPaths] = useState<AdminTodayPath[]>([]);
  const [referrers, setReferrers] = useState<AdminReferrer[]>([]);

  // v2.10 — 통합 메트릭 폴링. authorized 전엔 시작하지 않아 403 도배 차단.
  const dashboard = useDashboardMetrics(
    toLinePoint,
    SERVER_METRICS_POLL_INTERVAL_MS,
    SERVER_METRICS_BUFFER_SIZE,
    authorized,
  );

  const [realtimeMetrics, setRealtimeMetrics] = useState<MetricData[]>([]);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('online');
  const [serverResource, setServerResource] = useState<ServerResource | null>(null);

  // 1. 대시보드 데이터 (통계 + 제보 대기열)
  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, pendingRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/popups/crawl/pending?size=100'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (pendingRes.ok) setPendingPopups(await pendingRes.json());
    } catch (e) {
      console.error('대시보드 데이터 로딩 실패', e);
      if (isPreviewEnv()) {
        setStats(devAdminStats);
        setPendingPopups(devPending);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    if (activeTab !== 'DASHBOARD' && activeTab !== 'SYSTEM') return; // 서버 지표 폴링은 두 탭에서만

    const fetchMetrics = async () => {
      try {
        const res = await apiFetch('/api/admin/metrics/server-status');
        if (res.ok) {
          const newData = await res.json();
          setServerStatus('online');
          setServerResource({
            memoryUsedMb: Number(newData.memory ?? 0),
            memoryTotalMb: Number(newData.memoryTotal ?? 0),
            diskUsedGb: Number(newData.diskUsed ?? 0),
            diskTotalGb: Number(newData.diskTotal ?? 0),
            heapUsedMb: Number(newData.heap ?? 0),
            heapMaxMb: Number(newData.heapMax ?? 0),
          });
          setRealtimeMetrics((prev) => {
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
            const updated = [...prev, { time: timeStr, cpu: newData.cpu, memory: newData.memory }];
            return updated.slice(-SERVER_METRICS_BUFFER_SIZE);
          });
        } else {
          setServerStatus('offline');
        }
      } catch (e) {
        setServerStatus('offline');
      }
    };

    const interval = setInterval(fetchMetrics, SERVER_METRICS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeTab, authorized]);

  // 2. 전체 팝업 로딩
  const loadAllPopups = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/admin/popups/all');
      if (res.ok) setAllPopups(await res.json());
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  // 3. 메이트 게시글 로딩
  const loadMatePosts = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/admin/mate-posts');
      if (res.ok) setMatePosts(await res.json());
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  // 4. 회원 목록 로딩
  const loadUsers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch('/api/admin/users');
      if (!res.ok) {
        setLoadError('회원 목록을 불러오지 못했습니다.');
        return;
      }
      setUsers(await res.json());
    } catch {
      setLoadError('서버에 연결하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. 방문 통계 로딩 (익명 집계)
  const loadVisitStats = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch('/api/admin/visits/stats');
      if (!res.ok) {
        setLoadError('방문 통계를 불러오지 못했습니다.');
        return;
      }
      setVisitStats(await res.json());
      const tp = await apiFetch('/api/admin/visits/today-paths');
      if (tp.ok) setTodayPaths(await tp.json());
      // 유입 경로는 백엔드 배포 후에야 생기는 엔드포인트 — 별도 try 로 감싸 위 두 집계까지
      // 같이 실패하는 일이 없게 한다.
      try {
        const rf = await apiFetch('/api/admin/visits/referrers?days=7');
        if (rf.ok) setReferrers(await rf.json());
      } catch {
        /* 네트워크 오류 시 빈 목록 유지 — 위 두 집계까지 같이 죽이지는 않는다 */
      }
    } catch (e) {
      if (isPreviewEnv()) setVisitStats(devVisitStats);
    } finally {
      setIsLoading(false);
    }
  };

  // 탭 변경 시 데이터 로딩
  useEffect(() => {
    if (!authorized) return;
    if (activeTab === 'DASHBOARD') {
      loadDashboardData();
      loadVisitStats();
    } else if (activeTab === 'PENDING') loadDashboardData();
    else if (activeTab === 'POPUPS') loadAllPopups();
    else if (activeTab === 'MATES') loadMatePosts();
    else if (activeTab === 'COMMENTS') loadComments();
    else if (activeTab === 'MEMBERS') loadUsers();
    else if (activeTab === 'VISITS') loadVisitStats();
    else setIsLoading(false); // SYSTEM / FEEDBACK / AUDIT / VISITORS 는 각자 불러온다
  }, [activeTab, authorized]);

  /**
   * 모든 기기에서 로그아웃 — 토큰이 샜다고 의심될 때 쓰는 비상 스위치.
   *
   * <p>누른 본인도 로그아웃된다. 내 토큰만 남겨 두면 그게 샜을 때 아무것도 막지 못한다.
   *
   * <p>서버가 성공을 돌려준 뒤에야 로컬 토큰을 지운다. 먼저 지우면 서버가 실패했을 때
   * "로그아웃된 것처럼 보이는데 토큰은 살아 있는" 최악의 상태가 된다.
   */
  const handleRevokeAllSessions = async () => {
    const confirmed = await confirmAction({
      title: '모든 기기에서 로그아웃할까요?',
      text: '지금 보고 있는 이 창을 포함해 전부 로그아웃됩니다. 이미 열려 있는 실시간 로그 연결은 끊길 때까지 유지됩니다.',
      confirmText: '로그아웃',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await apiFetch('/api/admin/session/revoke-all', { method: 'POST' });
      if (!res.ok) {
        notifyError('처리하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      clearAuthToken();
      window.localStorage.removeItem('user');
      router.replace('/login');
    } catch {
      notifyError('서버에 연결하지 못했습니다.');
    }
  };

  // ================= [API 기능 핸들러] =================
  const handleApprove = async (id: number) => {
    if (!(await confirmAction({ text: '승인하시겠습니까?' }))) return;
    try {
      const res = await apiFetch(`/api/admin/popups/crawl/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        notifySuccess('승인 완료!');
        loadDashboardData();
      } else {
        notifyError('승인하지 못했습니다. 입력 정보와 서버 상태를 확인해 주세요.');
      }
    } catch {
      notifyError('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (id: number) => {
    if (!(await confirmAction({ text: '거절하시겠습니까?', destructive: true }))) return;
    try {
      const res = await apiFetch(`/api/admin/popups/crawl/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        notifySuccess('반려 완료');
        loadDashboardData();
      } else {
        notifyError('반려하지 못했습니다. 서버 상태를 확인해 주세요.');
      }
    } catch {
      notifyError('거절 처리 중 오류가 발생했습니다.');
    }
  };

  /*
   * 상태 변경은 select 입력이 필요해 sweetalert2 의 `input: 'select'` 를 그대로 사용한다.
   */
  const handleChangeStatus = async (id: number, currentStatus: string) => {
    const { value: newStatus } = await Swal.fire({
      title: '상태 변경',
      input: 'select',
      inputOptions: { 영업중: '영업중', 혼잡: '혼잡', 종료: '종료' },
      showCancelButton: true,
      inputValue: currentStatus,
    });
    if (!newStatus) return;
    try {
      const res = await apiFetch(`/api/admin/popups/${id}/status?status=${newStatus}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        notifySuccess('변경 완료!');
        loadAllPopups();
      }
    } catch (e) {
      notifyError('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 이미지 없는 공개 팝업에 Pexels 커버를 배정(수동 백필). 백엔드 pexels.api-key 설정 필요.
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isDeduping, setIsDeduping] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  // 번역은 몇 분씩 걸린다. 버튼만 비활성으로 두면 멈춘 건지 도는 건지 알 수 없어 숫자를 보여준다.
  const [translationProgress, setTranslationProgress] = useState<string | null>(null);
  // 수동 수집(지금 수집하기) 진행 중 — PC 켤 때마다 도는 자동 수집 대신, 원할 때만 누르는 용도.
  const [isCrawling, setIsCrawling] = useState(false);
  const [comments, setComments] = useState<
    { id: number; sender: string; message: string; sendTime?: string; popupName?: string }[]
  >([]);
  const [selectedComments, setSelectedComments] = useState<Set<number>>(new Set());
  /**
   * 지금 수집하기 — 관리자가 누를 때만 1회 수집한다.
   *
   * <p>기존엔 PC(로컬 Ollama)가 켜져 있으면 백엔드가 10분마다 자동으로 수집을 돌려 PC 부담이 컸다.
   * 이 버튼으로 원할 때만 돌리고, 하루 2번(4시·16시) 고정 수집은 그대로 유지한다.
   *
   * <p>수집은 몇 분 걸릴 수 있어 HTTP 응답이 먼저 끊길 수 있다. 그래도 서버에서는 계속 진행되므로
   * 통신 끊김을 '실패' 로 단정하지 않고 진행 중으로 안내한다.
   */
  const handleRunCrawl = async () => {
    const ok = await confirmAction({
      text: '지금 팝업을 수집할까요?\n서버에서 몇 분 걸릴 수 있고, 이 창을 닫아도 계속 진행됩니다.',
    });
    if (!ok) return;
    setIsCrawling(true);
    try {
      const res = await apiFetch('/api/admin/popups/crawl/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const s = (data?.stats ?? {}) as Record<string, number>;
        notifySuccess(
          `수집 완료 — 신규 ${s.autoPublished ?? 0}건 · 검수대기 ${s.pendingReview ?? 0}건`,
        );
        loadAllPopups();
      } else {
        notifyError('수집 요청이 거부됐습니다 (크롤러 활성화·관리자 권한 확인)');
      }
    } catch {
      notifySuccess('수집이 서버에서 계속 진행 중입니다. 잠시 후 새로고침해 확인해 주세요.');
    } finally {
      setIsCrawling(false);
    }
  };

  const handleBackfillPhotos = async () => {
    if (!(await confirmAction({ text: '이미지 없는 팝업에 Pexels 커버 사진을 배정할까요?' })))
      return;
    setIsBackfilling(true);
    try {
      const res = await apiFetch('/api/admin/popups/backfill-photos?limit=150', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        /*
         * 0건은 <b>성공이 아니다.</b> 그리고 0건에도 이유가 셋이라 서로 다른 말을 해야 한다.
         *
         * <p>예전엔 서버가 배정 개수만 돌려줘서 "커버 0개 배정 완료" 라는 성공 알림이 떴다.
         * Pexels 키가 없어도 200 에 {@code assigned:0} 이라, 화면만 보면 <b>키가 빠진 것과 채울
         * 것이 없는 것이 똑같아 보였다.</b> 사진 없는 팝업이 수백 건인데 0건이 뜨니 기능이 죽은
         * 줄 알 수밖에 없었다.
         *
         * <p>{@code configured}/{@code photoless}/{@code searchEmpty} 는 그 구분을 위해 서버에
         * 새로 실은 값이다. 아직 안 올라간 서버(옛 배포)는 이 값들이 없으므로 undefined 가 되고,
         * 그때는 "0건이면 경고" 라는 최소한의 정직함만 남는다.
         */
        const assigned = Number(data.assigned ?? 0);
        const photoless = data.photoless as number | undefined;
        const configured = data.configured as boolean | undefined;
        const searchEmpty = Number(data.searchEmpty ?? 0);
        const scanned = Number(data.scanned ?? 0);

        if (configured === false) {
          notifyError(
            `서버에 PEXELS_API_KEY 가 설정돼 있지 않습니다. 사진 없는 팝업 ${photoless ?? '?'}건은 그대로입니다.`,
          );
        } else if (photoless === 0) {
          notifySuccess('사진 없는 팝업이 없습니다. 채울 것이 없어요.');
        } else if (assigned === 0 && scanned > 0 && searchEmpty === scanned) {
          // 시도한 전부가 후보를 못 받았다 = 코드가 아니라 키·쿼터 문제다.
          notifyError(
            'Pexels 검색이 한 건도 응답하지 않았습니다. 키 만료·쿼터 초과를 확인해 주세요.',
          );
        } else if (assigned === 0) {
          notifyError('배정된 커버가 0건입니다. 서버 로그(PopupPhotoService)를 확인해 주세요.');
        } else {
          const left = photoless === undefined ? 0 : photoless - assigned;
          notifySuccess(
            left > 0
              ? `커버 ${assigned}개 배정 — ${left}건 남음(다시 눌러 주세요)`
              : `커버 ${assigned}개 배정 완료`,
          );
        }
        loadAllPopups();
      } else {
        notifyError('커버 배정 실패 (Pexels 키 설정 여부 확인)');
      }
    } catch (e) {
      notifyError('커버 배정 중 오류가 발생했습니다.');
    } finally {
      setIsBackfilling(false);
    }
  };

  /**
   * 번역 백필을 시작하고 끝날 때까지 진행 상황을 따라간다.
   *
   * <p>번역은 <b>동기로 기다릴 수 없다.</b> 100건이면 LLM 호출이 다섯 번이고 로컬 Ollama 는 한 번에
   * 수십 초가 걸린다. apiFetch 의 제한은 12초라 예전 방식(동기 호출)은 언제나 시간초과였다 —
   * 처음 눌렀을 때 결과가 돌아온 건 Ollama 가 꺼져 있어 아무 일도 안 하고 즉시 반환했기 때문이다.
   *
   * <p>그래서 시작만 알리고(202) 서버가 백그라운드로 돈다. 이 함수는 상태만 물어본다. 창을 닫아도
   * 작업은 계속된다.
   *
   * @param maxBatches 0 이면 대상이 마를 때까지, 1 이상이면 그 횟수만.
   */
  const runTranslationJob = async (maxBatches: number) => {
    setIsTranslating(true);
    setTranslationProgress('시작하는 중…');
    try {
      const res = await apiFetch(
        `/api/admin/popups/backfill-translations/bulk?retryMissing=true&maxBatches=${maxBatches}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        notifyError('번역 시작 실패');
        return;
      }
      const start = await res.json();
      if (!start.started && start.running) {
        notifyError('이미 번역 작업이 돌고 있습니다. 끝난 뒤에 다시 눌러 주세요.');
        return;
      }

      for (let i = 0; i < TRANSLATION_MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, TRANSLATION_POLL_MS));
        const statusRes = await apiFetch('/api/admin/popups/backfill-translations/status');
        if (!statusRes.ok) continue;
        const s = await statusRes.json();
        setTranslationProgress(`번역 ${s.translated ?? 0} · 비움 ${s.skipped ?? 0}`);
        if (s.state === 'RUNNING') continue;

        // 확신이 없어 비운 건수까지 보여준다 — "몇 건이 안 됐나" 가 다음 판단의 근거다.
        const counts = `번역 ${s.translated ?? 0} · 확신없어 비움 ${s.skipped ?? 0}`;
        if (s.state === 'COMPLETED')
          notifySuccess(`${counts}${s.message ? ` — ${s.message}` : ''}`);
        else notifyError(`${s.state} — ${s.message ?? '알 수 없는 이유로 멈췄습니다'} (${counts})`);
        loadAllPopups();
        return;
      }
      notifySuccess('아직 돌고 있습니다. 서버에서 계속 진행되니 잠시 뒤 다시 확인해 주세요.');
    } catch {
      notifyError('번역 중 오류가 발생했습니다.');
    } finally {
      setIsTranslating(false);
      setTranslationProgress(null);
    }
  };

  /**
   * 번역 시험 — 한 배치(최대 100건)만 돌린다.
   *
   * <p>결과를 보고 전체를 돌릴지 정하기 위한 것이다. 틀린 이름은 빈칸보다 나쁘고(빈칸이면
   * 한국어 원문이 나와 최소한 틀리지는 않는다), 되돌리려면 DB 를 직접 손봐야 한다.
   */
  const handleTranslateOnce = async () => {
    if (
      !(await confirmAction({
        text: 'PC 의 Ollama 를 켜 두셨나요? 번역을 한 배치(최대 100건)만 돌려봅니다.',
      }))
    )
      return;
    await runTranslationJob(1);
  };

  /**
   * 번역 전체 — 남은 것을 배치로 계속 돌린다.
   *
   * <p>{@code retryMissing=true} 가 핵심이다. 예전에 "확신 없어 비움" 으로 끝난 행에도 시도 표시가
   * 찍혀 있어, 이걸 빼면 <b>한 건도 다시 시도되지 않는다.</b>
   */
  const handleTranslateAll = async () => {
    if (
      !(await confirmAction({
        text: '남은 팝업을 전부 번역합니다. 시험 배치 결과를 확인하셨나요? 되돌리려면 DB 를 직접 손봐야 합니다.',
      }))
    )
      return;
    await runTranslationJob(0);
  };

  // 이름이 완전히 같은 중복 팝업 정리 — 먼저 미리보기로 몇 건인지 보여주고 확인받은 뒤 적용.
  const handleDedupe = async () => {
    try {
      const res = await apiFetch('/api/admin/popups/duplicates');
      if (!res.ok) {
        notifyError('중복 조회 실패');
        return;
      }
      const groups = await res.json();
      if (!Array.isArray(groups) || groups.length === 0) {
        notifySuccess('이름이 완전히 같은 중복이 없습니다.');
        return;
      }
      const total = groups.reduce(
        (a: number, g: { count?: number }) => a + Math.max(0, (g.count ?? 1) - 1),
        0,
      );
      const sample = groups
        .slice(0, 6)
        .map((g: { name?: string; count?: number }) => `· ${g.name} (${g.count}건)`)
        .join('\n');
      const ok = await confirmAction({
        text: `이름이 완전히 같은 중복 ${groups.length}그룹 · 총 ${total}건을 숨길까요? (그룹마다 대표 1건만 남깁니다)\n\n${sample}${groups.length > 6 ? '\n…' : ''}`,
        destructive: true,
      });
      if (!ok) return;
      setIsDeduping(true);
      const applyRes = await apiFetch('/api/admin/popups/dedupe', { method: 'POST' });
      if (applyRes.ok) {
        const data = await applyRes.json();
        notifySuccess(`중복 ${data.hidden ?? 0}건 정리 완료`);
        loadAllPopups();
      } else {
        notifyError('중복 정리 실패');
      }
    } catch (e) {
      notifyError('중복 정리 중 오류가 발생했습니다.');
    } finally {
      setIsDeduping(false);
    }
  };

  /**
   * 재확인이 필요해 막힌 작업.
   *
   * <p>서버가 428 로 답하면 확인 창을 띄우고, 확인이 끝나면 <b>그 작업을 그대로 다시</b> 실행한다.
   * 사용자가 무엇을 하려 했는지 기억해 주지 않으면 "확인했는데 왜 아무 일도 안 일어나지" 가 된다.
   */
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  /**
   * 428(재확인 필요)이면 확인 창을 띄우고 참을 돌려준다 — 호출부는 거기서 멈추면 된다.
   *
   * <p><b>428 을 쓰는 곳이 둘이다.</b> 관리자 재인증(B-2)과 정책 재동의가 같은 코드를 쓴다.
   * 상태코드만 보고 재인증 창을 띄우면, 정책 미동의로 막힌 요청에 6자리를 물어보게 되고 —
   * 확인에 성공해도 다시 정책 때문에 428 이라 <b>무한히 반복</b>된다. 그래서 본문의 error 를
   * 함께 본다. 정책 쪽은 이 함수가 관여하지 않고 재동의 모달(AuthGuard)이 처리한다.
   */
  const needsReauth = async (res: Response, retry: () => Promise<void>) => {
    if (res.status !== 428) return false;

    let body = '';
    try {
      body = await res.clone().text();
    } catch {
      /* 본문을 못 읽으면 재인증으로 본다 — 그쪽이 화면에 안내가 있는 경로다 */
    }
    if (body.includes('POLICY_CONSENT_REQUIRED')) {
      notifyError({
        title: '동의가 필요합니다',
        text: '최신 약관과 개인정보 처리방침에 동의한 뒤 다시 시도해 주세요.',
      });
      return true;
    }

    setPendingAction(() => retry);
    return true;
  };

  const handleDeleteMatePost = async (id: number) => {
    if (!(await confirmAction({ text: '삭제하시겠습니까?', destructive: true }))) return;
    try {
      const res = await apiFetch(`/api/admin/mate-posts/${id}`, { method: 'DELETE' });
      if (await needsReauth(res, () => handleDeleteMatePost(id))) return;
      if (res.ok) {
        notifySuccess('삭제 완료');
        loadMatePosts();
      }
    } catch (e) {
      notifyError('삭제 중 오류가 발생했습니다.');
    }
  };

  // 라이브 댓글(실시간 톡방) 관리 — 최근 100건 조회 + 개별/일괄 삭제.
  const loadComments = async () => {
    try {
      const res = await apiFetch('/api/admin/chat/recent');
      if (res.ok) {
        setComments(await res.json());
        setSelectedComments(new Set());
      }
    } catch (e) {
      notifyError('댓글을 불러오지 못했습니다.');
    }
  };

  const toggleCommentSelect = (id: number) => {
    setSelectedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllComments = () => {
    setSelectedComments((prev) =>
      prev.size === comments.length ? new Set() : new Set(comments.map((c) => c.id)),
    );
  };

  const handleDeleteComment = async (id: number) => {
    if (!(await confirmAction({ text: '이 댓글을 삭제할까요?', destructive: true }))) return;
    try {
      const res = await apiFetch(`/api/admin/chat/${id}`, { method: 'DELETE' });
      if (await needsReauth(res, () => handleDeleteComment(id))) return;
      if (res.ok) {
        notifySuccess('삭제 완료');
        setComments((prev) => prev.filter((c) => c.id !== id));
        setSelectedComments((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        // 서버가 담아준 원인(message)을 그대로 노출 — 원인 없는 "삭제 실패"로 디버깅이 막히지 않게.
        const data = await res.json().catch(() => null);
        notifyError(data?.message ? `삭제 실패: ${data.message}` : `삭제 실패 (${res.status})`);
      }
    } catch (e) {
      notifyError('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleBulkDeleteComments = async () => {
    const ids = Array.from(selectedComments);
    if (ids.length === 0) return;
    if (
      !(await confirmAction({
        text: `선택한 댓글 ${ids.length}개를 삭제할까요?`,
        destructive: true,
      }))
    )
      return;
    try {
      // 개별 삭제 엔드포인트를 병렬 호출(각각 독립 — 일부 실패해도 나머지는 삭제).
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await apiFetch(`/api/admin/chat/${id}`, { method: 'DELETE' });
            if (r.ok) return { id, ok: true as const, message: null };
            const data = await r.json().catch(() => null);
            return { id, ok: false as const, message: data?.message ?? `HTTP ${r.status}` };
          } catch {
            return { id, ok: false as const, message: '네트워크 오류' };
          }
        }),
      );
      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failed = results.filter((r) => !r.ok);
      setComments((prev) => prev.filter((c) => !okIds.has(c.id)));
      setSelectedComments((prev) => {
        const next = new Set<number>();
        prev.forEach((id) => {
          if (!okIds.has(id)) next.add(id);
        });
        return next;
      });
      if (failed.length === 0) notifySuccess(`${okIds.size}개 삭제 완료`);
      else notifyError(`${okIds.size}개 삭제 완료, ${failed.length}개 실패 — ${failed[0].message}`);
    } catch (e) {
      notifyError('일괄 삭제 중 오류가 발생했습니다.');
    }
  };

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100 dark:bg-ink-900 text-muted-foreground">
        <span className="text-sm">권한 확인 중...</span>
      </div>
    );
  }

  const lastMetric = realtimeMetrics[realtimeMetrics.length - 1];
  const cpuNow = lastMetric?.cpu ?? 0;
  const memNow = lastMetric?.memory ?? Math.round(Number(dashboard.snapshot?.jvm?.heapUsedMb ?? 0));
  const dbActive = dashboard.snapshot?.db?.active ?? 0;

  return (
    <div className="min-h-screen flex bg-cream-100 dark:bg-ink-900 text-foreground">
      {/* ===== 좌측 사이드바 ===== */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-surface">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[var(--color-border)]">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-300 text-ink-900">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-black leading-tight">관리자</p>
            <p className="text-[11px] text-muted-foreground leading-tight">POP-SPOT 운영</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const badgeCount = item.badge ? (stats?.pendingPopups ?? pendingPopups.length) : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  active
                    ? 'bg-lime-300 text-ink-900'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                <Icon size={17} className="shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && badgeCount > 0 && (
                  <span
                    className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-black ${active ? 'bg-ink-900 text-lime-300' : 'bg-hot-400 text-white'}`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => router.push('/')}
          className="m-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-bold text-muted-foreground hover:bg-foreground/5 transition-colors"
        >
          <LogOut size={16} /> 서비스로 나가기
        </button>
      </aside>

      {/* ===== 메인 ===== */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* 상단 바 (모바일 탭 셀렉트 포함) */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-surface/90 backdrop-blur px-4 md:px-8 py-4">
          <h1 className="text-lg md:text-2xl font-black tracking-tight">
            {TAB_TITLE[activeTab] ?? '관리자'}
          </h1>
          <div className="md:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-surface px-3 py-2 text-sm font-bold"
            >
              {NAV.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24">
          <div className="max-w-6xl mx-auto">
            {isLoading && (
              <div className="flex justify-center py-20">
                <div className="animate-spin w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full"></div>
              </div>
            )}

            {/* 불러오기 실패는 실패라고 말한다. 아래 탭들이 빈 목록을 '아직 없음' 으로
                그리기 때문에, 이 줄이 없으면 고장과 한산함이 똑같아 보인다. */}
            {!isLoading && loadError && (
              <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {loadError} 아래 내용은 실제와 다를 수 있습니다.
              </div>
            )}

            {/* ===== 대시보드 ===== */}
            {!isLoading && activeTab === 'DASHBOARD' && (
              <DashboardTab
                stats={stats}
                visitStats={visitStats}
                pendingPopups={pendingPopups}
                dashboard={dashboard}
                cpuNow={cpuNow}
                memNow={memNow}
                dbActive={dbActive}
                serverStatus={serverStatus}
                setActiveTab={setActiveTab}
              />
            )}

            {/* ===== 제보 승인 (전체) ===== */}
            {!isLoading && activeTab === 'PENDING' && (
              <PendingTab
                pendingPopups={pendingPopups}
                handleApprove={handleApprove}
                handleReject={handleReject}
              />
            )}

            {/* ===== 팝업 관리 ===== */}
            {!isLoading && activeTab === 'POPUPS' && (
              <PopupsTab
                allPopups={allPopups}
                isCrawling={isCrawling}
                isBackfilling={isBackfilling}
                isDeduping={isDeduping}
                handleRunCrawl={handleRunCrawl}
                handleBackfillPhotos={handleBackfillPhotos}
                handleDedupe={handleDedupe}
                handleChangeStatus={handleChangeStatus}
                isTranslating={isTranslating}
                translationProgress={translationProgress}
                handleTranslateOnce={handleTranslateOnce}
                handleTranslateAll={handleTranslateAll}
              />
            )}

            {/* ===== 커뮤니티 관리 ===== */}
            {!isLoading && activeTab === 'MATES' && (
              <MatesTab matePosts={matePosts} handleDeleteMatePost={handleDeleteMatePost} />
            )}

            {/* ===== 라이브 댓글 ===== */}
            {!isLoading && activeTab === 'COMMENTS' && (
              <CommentsTab
                comments={comments}
                selectedComments={selectedComments}
                loadComments={loadComments}
                toggleCommentSelect={toggleCommentSelect}
                toggleSelectAllComments={toggleSelectAllComments}
                handleDeleteComment={handleDeleteComment}
                handleBulkDeleteComments={handleBulkDeleteComments}
              />
            )}

            {/* ===== 회원 ===== */}
            {!isLoading && activeTab === 'MEMBERS' && <MembersTab users={users} />}

            {/* ===== 방문 통계 ===== */}
            {!isLoading && activeTab === 'VISITS' && visitStats && (
              <VisitsTab
                visitStats={visitStats}
                todayPaths={todayPaths}
                referrers={referrers}
                loadVisitStats={loadVisitStats}
              />
            )}

            {/* ===== 방문자 목록 ===== */}
            {/* 기간·페이지를 스스로 관리하므로 데이터도 스스로 불러온다. */}
            {activeTab === 'VISITORS' && <VisitorsTab />}

            {/* ===== 의견 ===== */}
            {activeTab === 'FEEDBACK' && <FeedbackTab />}

            {/* ===== 감사 로그 (스스로 불러온다 — 위 loadX 분기에 넣지 않는 이유) ===== */}
            {activeTab === 'AUDIT' && <AuditTab />}

            {/* 되돌릴 수 없는 작업이 428 로 막히면 뜬다. 확인이 끝나면 그 작업을 그대로 다시 실행한다. */}
            <ReauthGate
              open={pendingAction !== null}
              onClose={() => setPendingAction(null)}
              onConfirmed={() => {
                const retry = pendingAction;
                setPendingAction(null);
                retry?.();
              }}
            />

            {/* ===== 시스템 (서버 지표 + 로그) ===== */}
            {activeTab === 'SYSTEM' && (
              <SystemTab
                onRevokeAllSessions={handleRevokeAllSessions}
                serverResource={serverResource}
                dashboard={dashboard}
                realtimeMetrics={realtimeMetrics}
                cpuNow={cpuNow}
                memNow={memNow}
                serverStatus={serverStatus}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
