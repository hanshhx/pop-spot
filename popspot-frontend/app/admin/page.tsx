"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    Check, X, ShieldCheck, MapPin, Store, AlertCircle,
    BarChart3, Users, MessageSquare, Gift, Trash2, Activity, Cpu,
    Database, Globe, Inbox, ChevronRight, LogOut, Footprints
} from "lucide-react";
import Swal from "sweetalert2";

import { apiFetch } from "../../src/lib/api";
import { confirmAction, notifyError, notifySuccess } from "@/lib/notify";
import type { PopupStore } from "@/types/popup";
import { MetricCard } from "@/components/admin/metrics/MetricCard";
import {
    useDashboardMetrics,
    type DashboardSnapshot,
} from "@/components/admin/metrics/useDashboardMetrics";
import { LogViewer } from "@/components/admin/log/LogViewer";
import { AdminFeedbackPanel } from "@/features/feedback/AdminFeedbackPanel";

interface MetricData {
    time: string;
    cpu: number;
    memory: number;
}

interface AdminStats {
    totalUsers?: number;
    totalPopups?: number;
    activePopups?: number;
    pendingPopups?: number;
    totalMatePosts?: number;
    pendingReview?: number;
    autoPublished?: number;
    todayStamps?: number;
}

interface AdminMatePost {
    id: number;
    title: string;
    content?: string;
    author?: { nickname?: string };
    createdAt?: string;
    isMegaphone?: boolean;
}

interface AdminUser {
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

interface AdminVisitStats {
    todayVisitors: number;
    todayPageviews: number;
    todayGuests: number;
    todayMembers: number;
    weekVisitors: number;
    daily: { date: string; visitors: number }[];
    topPaths: { path: string; count: number }[];
}

// 실시간 폴링 — 3초 주기. 더 잦으면 백엔드 부하, 더 느슨하면 모니터링 가치 떨어짐.
const SERVER_METRICS_POLL_INTERVAL_MS = 3000;
const SERVER_METRICS_BUFFER_SIZE = 15;

/** 로컬 미리보기 여부 — dev 빌드이거나 localhost 접속. 프로덕션(실도메인)에서는 항상 false. */
function isPreviewEnv() {
    if (process.env.NODE_ENV === "development") return true;
    return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

/**
 * 통합 메트릭 (`/api/admin/metrics/dashboard`) 응답을 차트 점 1 개로 압축.
 * useDashboardMetrics 훅이 매 폴링마다 호출한다.
 */
function toLinePoint(s: DashboardSnapshot, now: Date): Record<string, number | string> {
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    return {
        time,
        heapMb: Number(s.jvm?.heapUsedMb ?? 0),
        httpRps: Number(s.http?.requestCount ?? 0),
    };
}

/**
 * 좌측 사이드바 네비게이션 — 개선안 #7: 상단 가로 탭 + "MASTER ADMIN" 해커 터미널 톤 대신
 * 소비자 앱과 같은 디자인 시스템의 밝은 사이드바. 서비스 운영 항목이 위, 시스템은 맨 아래.
 */
const NAV: { id: string; label: string; icon: typeof Users; badge?: boolean }[] = [
    { id: "DASHBOARD", label: "대시보드", icon: BarChart3 },
    { id: "POPUPS", label: "팝업 관리", icon: Store },
    { id: "PENDING", label: "제보 승인", icon: AlertCircle, badge: true },
    { id: "MEMBERS", label: "회원", icon: Users },
    { id: "MATES", label: "커뮤니티", icon: MessageSquare },
    { id: "COMMENTS", label: "라이브 댓글", icon: MessageSquare },
    { id: "VISITS", label: "방문 통계", icon: Globe },
    { id: "VISITORS", label: "방문자", icon: Footprints },
    { id: "REWARDS", label: "보상 지급", icon: Gift },
    { id: "FEEDBACK", label: "의견", icon: Inbox },
    { id: "SYSTEM", label: "시스템", icon: Activity },
];

const TAB_TITLE: Record<string, string> = {
    DASHBOARD: "서비스 대시보드",
    POPUPS: "팝업 관리",
    PENDING: "제보 승인",
    MEMBERS: "회원",
    MATES: "커뮤니티 관리",
    COMMENTS: "라이브 댓글 관리",
    VISITS: "방문 통계",
    VISITORS: "방문자 목록",
    REWARDS: "보상 지급",
    FEEDBACK: "의견",
    SYSTEM: "시스템",
};

/* [redesign/test 전용] 백엔드 없을 때(로컬) 관리자 화면을 미리볼 수 있게 하는 목업. */
const devAdminStats: AdminStats = {
    totalUsers: 22,
    activePopups: 134,
    pendingPopups: 3,
    totalMatePosts: 8,
    todayStamps: 12,
};
const devPending: PopupStore[] = [
    { id: 5001, name: "성수 커피 팝업", location: "서울 성동구 성수동", status: "PENDING", viewCount: 0, reporterId: "user_88" },
    { id: 5002, name: "한남 브랜드전", location: "서울 용산구 한남동", status: "PENDING", viewCount: 0, reporterId: "user_12" },
    { id: 5003, name: "홍대 아트마켓", location: "서울 마포구 홍대", status: "PENDING", viewCount: 0, reporterId: "user_41" },
];
const devVisitStats: AdminVisitStats = {
    todayVisitors: 87,
    todayPageviews: 312,
    todayGuests: 61,
    todayMembers: 26,
    weekVisitors: 540,
    daily: [
        { date: "07.04", visitors: 62 },
        { date: "07.05", visitors: 74 },
        { date: "07.06", visitors: 58 },
        { date: "07.07", visitors: 91 },
        { date: "07.08", visitors: 103 },
        { date: "07.09", visitors: 128 },
        { date: "07.10", visitors: 87 },
    ],
    topPaths: [
        { path: "/", count: 210 },
        { path: "/popup", count: 156 },
        { path: "/music", count: 44 },
    ],
};

export default function AdminPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("DASHBOARD");
    const [isLoading, setIsLoading] = useState(true);

    /*
     * v2.13.3 — role 게이트. 일반 유저가 /admin 에 오면 polling/SSE 가 403 도배를 일으켜
     * mount 시점에 role 을 검사해 ADMIN 이 아니면 리다이렉트한다. 서버 권한은 토큰으로 별도 강제.
     * [redesign/test] 로컬(백엔드 없음)에서는 미리보기를 위해 게이트를 통과시킨다(프로덕션 무관).
     */
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem("user");
            if (!raw) {
                if (isPreviewEnv()) { setAuthorized(true); return; }
                router.replace("/login");
                return;
            }
            const parsed = JSON.parse(raw) as { role?: string };
            const role = (parsed.role ?? "").trim().toUpperCase();
            const isAdmin = role === "ROLE_ADMIN" || role === "ADMIN";
            if (!isAdmin) {
                if (isPreviewEnv()) { setAuthorized(true); return; }
                router.replace("/");
                return;
            }
            setAuthorized(true);
        } catch {
            if (isPreviewEnv()) { setAuthorized(true); return; }
            router.replace("/login");
        }
    }, [router]);

    const [stats, setStats] = useState<AdminStats | null>(null);
    const [pendingPopups, setPendingPopups] = useState<PopupStore[]>([]);
    const [allPopups, setAllPopups] = useState<PopupStore[]>([]);
    const [matePosts, setMatePosts] = useState<AdminMatePost[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [visitStats, setVisitStats] = useState<AdminVisitStats | null>(null);
    const [todayPaths, setTodayPaths] = useState<{ path: string; total: number; members: number; guests: number }[]>([]);
    const [visitors, setVisitors] = useState<{ visitorId: string; visits: number; paths: string; lastSeen: string; guest: boolean }[]>([]);

    // v2.10 — 통합 메트릭 폴링. authorized 전엔 시작하지 않아 403 도배 차단.
    const dashboard = useDashboardMetrics(
        toLinePoint,
        SERVER_METRICS_POLL_INTERVAL_MS,
        SERVER_METRICS_BUFFER_SIZE,
        authorized,
    );

    const [realtimeMetrics, setRealtimeMetrics] = useState<MetricData[]>([]);
    const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('online');

    // 보상 지급 폼 상태
    const [rewardForm, setRewardForm] = useState({ nickname: "", itemType: "MEGAPHONE", amount: 1 });

    // 1. 대시보드 데이터 (통계 + 제보 대기열)
    const loadDashboardData = async () => {
        setIsLoading(true);
        try {
            const [statsRes, pendingRes] = await Promise.all([
                apiFetch("/api/admin/stats"),
                apiFetch("/api/admin/popups/pending")
            ]);
            if (statsRes.ok) setStats(await statsRes.json());
            if (pendingRes.ok) setPendingPopups(await pendingRes.json());
        } catch (e) {
            console.error("대시보드 데이터 로딩 실패", e);
            if (isPreviewEnv()) { setStats(devAdminStats); setPendingPopups(devPending); }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!authorized) return;
        if (activeTab !== "DASHBOARD" && activeTab !== "SYSTEM") return; // 서버 지표 폴링은 두 탭에서만

        const fetchMetrics = async () => {
            try {
                const res = await apiFetch("/api/admin/metrics/server-status");
                if (res.ok) {
                    const newData = await res.json();
                    setServerStatus('online');
                    setRealtimeMetrics(prev => {
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
            const res = await apiFetch("/api/admin/popups/all");
            if (res.ok) setAllPopups(await res.json());
        } catch (e) {} finally { setIsLoading(false); }
    };

    // 3. 메이트 게시글 로딩
    const loadMatePosts = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch("/api/admin/mate-posts");
            if (res.ok) setMatePosts(await res.json());
        } catch (e) {} finally { setIsLoading(false); }
    };

    // 4. 회원 목록 로딩
    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch("/api/admin/users");
            if (res.ok) setUsers(await res.json());
        } catch (e) {} finally { setIsLoading(false); }
    };

    // 5. 방문 통계 로딩 (익명 집계)
    const loadVisitStats = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch("/api/admin/visits/stats");
            if (res.ok) setVisitStats(await res.json());
            const tp = await apiFetch("/api/admin/visits/today-paths");
            if (tp.ok) setTodayPaths(await tp.json());
        } catch (e) {
            if (isPreviewEnv()) setVisitStats(devVisitStats);
        } finally { setIsLoading(false); }
    };

    const loadVisitors = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch("/api/admin/visits/visitors?days=7");
            if (res.ok) setVisitors(await res.json());
        } catch {
            /* 백엔드 미배포 시 빈 목록 유지 */
        } finally { setIsLoading(false); }
    };

    // 탭 변경 시 데이터 로딩
    useEffect(() => {
        if (!authorized) return;
        if (activeTab === "DASHBOARD") { loadDashboardData(); loadVisitStats(); }
        else if (activeTab === "PENDING") loadDashboardData();
        else if (activeTab === "POPUPS") loadAllPopups();
        else if (activeTab === "MATES") loadMatePosts();
        else if (activeTab === "COMMENTS") loadComments();
        else if (activeTab === "MEMBERS") loadUsers();
        else if (activeTab === "VISITS") loadVisitStats();
        else if (activeTab === "VISITORS") loadVisitors();
        else setIsLoading(false); // SYSTEM / REWARDS / FEEDBACK 은 별도 fetch 없음
    }, [activeTab, authorized]);

    // ================= [API 기능 핸들러] =================
    const handleApprove = async (id: number) => {
        if (!(await confirmAction({ text: "승인하시겠습니까?" }))) return;
        try {
            const res = await apiFetch(`/api/admin/popups/${id}/approve`, { method: "POST" });
            if (res.ok) {
                notifySuccess('승인 완료!');
                loadDashboardData();
            }
        } catch (e) {
            notifyError('승인 처리 중 오류가 발생했습니다.');
        }
    };

    const handleReject = async (id: number) => {
        if (!(await confirmAction({ text: "거절하시겠습니까?", destructive: true }))) return;
        try {
            const res = await apiFetch(`/api/admin/popups/${id}/reject`, { method: "DELETE" });
            if (res.ok) {
                notifySuccess('삭제 완료');
                loadDashboardData();
            }
        } catch (e) {
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
            inputOptions: { '영업중': '영업중', '혼잡': '혼잡', '종료': '종료' },
            showCancelButton: true,
            inputValue: currentStatus
        });
        if (!newStatus) return;
        try {
            const res = await apiFetch(`/api/admin/popups/${id}/status?status=${newStatus}`, { method: "PATCH" });
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
    const [comments, setComments] = useState<{ id: number; sender: string; message: string; sendTime?: string; popupName?: string }[]>([]);
    const [selectedComments, setSelectedComments] = useState<Set<number>>(new Set());
    const handleBackfillPhotos = async () => {
        if (!(await confirmAction({ text: "이미지 없는 팝업에 Pexels 커버 사진을 배정할까요?" }))) return;
        setIsBackfilling(true);
        try {
            const res = await apiFetch("/api/admin/popups/backfill-photos?limit=150", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                notifySuccess(`커버 ${data.assigned ?? 0}개 배정 완료`);
                loadAllPopups();
            } else {
                notifyError("커버 배정 실패 (Pexels 키 설정 여부 확인)");
            }
        } catch (e) {
            notifyError("커버 배정 중 오류가 발생했습니다.");
        } finally {
            setIsBackfilling(false);
        }
    };

    // 이름이 완전히 같은 중복 팝업 정리 — 먼저 미리보기로 몇 건인지 보여주고 확인받은 뒤 적용.
    const handleDedupe = async () => {
        try {
            const res = await apiFetch("/api/admin/popups/duplicates");
            if (!res.ok) { notifyError("중복 조회 실패"); return; }
            const groups = await res.json();
            if (!Array.isArray(groups) || groups.length === 0) {
                notifySuccess("이름이 완전히 같은 중복이 없습니다.");
                return;
            }
            const total = groups.reduce((a: number, g: { count?: number }) => a + Math.max(0, (g.count ?? 1) - 1), 0);
            const sample = groups.slice(0, 6).map((g: { name?: string; count?: number }) => `· ${g.name} (${g.count}건)`).join("\n");
            const ok = await confirmAction({
                text: `이름이 완전히 같은 중복 ${groups.length}그룹 · 총 ${total}건을 숨길까요? (그룹마다 대표 1건만 남깁니다)\n\n${sample}${groups.length > 6 ? "\n…" : ""}`,
                destructive: true,
            });
            if (!ok) return;
            setIsDeduping(true);
            const applyRes = await apiFetch("/api/admin/popups/dedupe", { method: "POST" });
            if (applyRes.ok) {
                const data = await applyRes.json();
                notifySuccess(`중복 ${data.hidden ?? 0}건 정리 완료`);
                loadAllPopups();
            } else {
                notifyError("중복 정리 실패");
            }
        } catch (e) {
            notifyError("중복 정리 중 오류가 발생했습니다.");
        } finally {
            setIsDeduping(false);
        }
    };

    const handleDeleteMatePost = async (id: number) => {
        if (!(await confirmAction({ text: "삭제하시겠습니까?", destructive: true }))) return;
        try {
            const res = await apiFetch(`/api/admin/mate-posts/${id}`, { method: "DELETE" });
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
            const res = await apiFetch("/api/admin/chat/recent");
            if (res.ok) {
                setComments(await res.json());
                setSelectedComments(new Set());
            }
        } catch (e) {
            notifyError("댓글을 불러오지 못했습니다.");
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
        if (!(await confirmAction({ text: "이 댓글을 삭제할까요?", destructive: true }))) return;
        try {
            const res = await apiFetch(`/api/admin/chat/${id}`, { method: "DELETE" });
            if (res.ok) {
                notifySuccess("삭제 완료");
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
            notifyError("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleBulkDeleteComments = async () => {
        const ids = Array.from(selectedComments);
        if (ids.length === 0) return;
        if (!(await confirmAction({ text: `선택한 댓글 ${ids.length}개를 삭제할까요?`, destructive: true }))) return;
        try {
            // 개별 삭제 엔드포인트를 병렬 호출(각각 독립 — 일부 실패해도 나머지는 삭제).
            const results = await Promise.all(
                ids.map(async (id) => {
                    try {
                        const r = await apiFetch(`/api/admin/chat/${id}`, { method: "DELETE" });
                        if (r.ok) return { id, ok: true as const, message: null };
                        const data = await r.json().catch(() => null);
                        return { id, ok: false as const, message: data?.message ?? `HTTP ${r.status}` };
                    } catch {
                        return { id, ok: false as const, message: "네트워크 오류" };
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
            else
                notifyError(
                    `${okIds.size}개 삭제 완료, ${failed.length}개 실패 — ${failed[0].message}`,
                );
        } catch (e) {
            notifyError("일괄 삭제 중 오류가 발생했습니다.");
        }
    };

    const handleGiveReward = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiFetch("/api/admin/reward", {
                method: "POST",
                body: JSON.stringify(rewardForm)
            });
            if (res.ok) {
                notifySuccess('지급 완료!');
                setRewardForm({ nickname: "", itemType: "MEGAPHONE", amount: 1 });
            } else {
                notifyError({ title: '실패', text: await res.text() });
            }
        } catch (e) {
            notifyError('보상 지급 중 오류가 발생했습니다.');
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
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-300 text-ink-900"><ShieldCheck size={18} /></span>
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
                                        ? "bg-lime-300 text-ink-900"
                                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                }`}
                            >
                                <Icon size={17} className="shrink-0" />
                                <span className="flex-1 text-left">{item.label}</span>
                                {item.badge && badgeCount > 0 && (
                                    <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-black ${active ? "bg-ink-900 text-lime-300" : "bg-hot-400 text-white"}`}>
                                        {badgeCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <button onClick={() => router.push("/")} className="m-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-bold text-muted-foreground hover:bg-foreground/5 transition-colors">
                    <LogOut size={16} /> 서비스로 나가기
                </button>
            </aside>

            {/* ===== 메인 ===== */}
            <main className="flex-1 min-w-0 flex flex-col">

                {/* 상단 바 (모바일 탭 셀렉트 포함) */}
                <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-surface/90 backdrop-blur px-4 md:px-8 py-4">
                    <h1 className="text-lg md:text-2xl font-black tracking-tight">{TAB_TITLE[activeTab] ?? "관리자"}</h1>
                    <div className="md:hidden">
                        <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-surface px-3 py-2 text-sm font-bold">
                            {NAV.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                        </select>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24">
                    <div className="max-w-6xl mx-auto">

                        {isLoading && (
                            <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full"></div></div>
                        )}

                        {/* ===== 대시보드 ===== */}
                        {!isLoading && activeTab === "DASHBOARD" && (
                            <div className="space-y-5 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                {/* 서비스 지표 4카드 */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                    <StatCard label="가입 유저" value={stats?.totalUsers ?? 0} sub="전체 회원" icon={<Users size={18} />} tone="lime" />
                                    <StatCard label="운영중 팝업" value={stats?.activePopups ?? 0} sub={dashboard.snapshot?.crawler?.crawledToday ? `오늘 +${dashboard.snapshot.crawler.crawledToday} 수집` : "실시간 운영중"} icon={<Store size={18} />} tone="green" />
                                    <StatCard label="승인 대기" value={stats?.pendingPopups ?? 0} sub="확인 필요" icon={<AlertCircle size={18} />} tone="amber" />
                                    <StatCard label="동행 게시글" value={stats?.totalMatePosts ?? 0} sub="커뮤니티" icon={<MessageSquare size={18} />} tone="violet" />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                                    {/* 최근 7일 방문 */}
                                    <div className="lg:col-span-3 rounded-2xl border border-[var(--color-border)] bg-surface p-5">
                                        <h3 className="font-bold text-sm mb-4">최근 7일 방문</h3>
                                        {!visitStats || visitStats.daily.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-12 text-center">데이터가 아직 없어요.</p>
                                        ) : (
                                            <div className="flex items-end justify-between gap-2 h-44">
                                                {(() => { const max = Math.max(...visitStats.daily.map((x) => x.visitors), 1); return visitStats.daily.map((d, i) => (
                                                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                                                        <span className="text-[10px] font-bold text-muted-foreground">{d.visitors}</span>
                                                        <div className={`w-full rounded-t-md ${i === visitStats.daily.length - 1 ? "bg-lime-500" : "bg-lime-300"}`} style={{ height: `${(d.visitors / max) * 100}%`, minHeight: d.visitors > 0 ? 4 : 0 }} />
                                                        <span className="text-[9px] text-muted-foreground">{d.date}</span>
                                                    </div>
                                                )); })()}
                                            </div>
                                        )}
                                    </div>

                                    {/* 제보 승인 대기 */}
                                    <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-surface p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-sm flex items-center gap-1.5"><AlertCircle size={15} className="text-amber-500" /> 제보 승인 대기 {pendingPopups.length}</h3>
                                            {pendingPopups.length > 3 && (
                                                <button onClick={() => setActiveTab("PENDING")} className="text-[11px] font-bold text-lime-600 dark:text-lime-300 hover:underline flex items-center gap-0.5">전체 <ChevronRight size={12} /></button>
                                            )}
                                        </div>
                                        {pendingPopups.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-10 text-center">대기 중인 제보가 없어요.</p>
                                        ) : (
                                            <ul className="space-y-2.5">
                                                {pendingPopups.slice(0, 4).map((p) => (
                                                    <li key={p.id} className="flex items-center gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-bold truncate">{p.name}</p>
                                                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-0.5"><MapPin size={10} /> {p.location}</p>
                                                        </div>
                                                        <button onClick={() => handleApprove(p.id)} className="shrink-0 rounded-lg bg-lime-300 px-2.5 py-1.5 text-[11px] font-bold text-ink-900 hover:bg-lime-400 transition-colors">승인</button>
                                                        <button onClick={() => handleReject(p.id)} className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:border-danger hover:text-danger transition-colors">반려</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>

                                {/* 하단 시스템 상태 스트립 — 서버 지표는 상단이 아닌 여기로 강등 */}
                                <button onClick={() => setActiveTab("SYSTEM")} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[var(--color-border)] bg-cream-100 dark:bg-ink-800/60 px-4 py-3 text-left text-xs text-muted-foreground transition-colors hover:bg-foreground/5">
                                    <span className="flex items-center gap-1.5 font-bold text-foreground"><Cpu size={13} className="text-lime-500" /> 시스템</span>
                                    <span>CPU <b className="text-foreground">{cpuNow}%</b></span>
                                    <span>MEM <b className="text-foreground">{memNow}MB</b></span>
                                    <span>DB <b className="text-foreground">{dbActive}</b> active</span>
                                    <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} /> {serverStatus === 'online' ? '정상' : '오프라인'}</span>
                                    <span className="ml-auto flex items-center gap-0.5 font-bold text-lime-600 dark:text-lime-300">자세히 <ChevronRight size={12} /></span>
                                </button>
                            </div>
                        )}

                        {/* ===== 제보 승인 (전체) ===== */}
                        {!isLoading && activeTab === "PENDING" && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {pendingPopups.length === 0 ? (
                                    <div className="text-center py-20 rounded-2xl border border-dashed border-[var(--color-border)] text-muted-foreground">대기 중인 제보가 없어요.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {pendingPopups.map((popup) => (
                                            <div key={popup.id} className="rounded-2xl border border-[var(--color-border)] bg-surface p-5 shadow-sm flex flex-col justify-between hover:border-lime-300/60 transition-colors">
                                                <div>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold rounded-full">승인 대기</span>
                                                        <span className="text-xs text-muted-foreground">제보자 {popup.reporterId}</span>
                                                    </div>
                                                    <h3 className="text-lg font-black mb-1.5 truncate">{popup.name}</h3>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {popup.location}</p>
                                                </div>
                                                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                                                    <button onClick={() => handleReject(popup.id)} className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] font-bold text-sm text-muted-foreground hover:border-danger hover:text-danger transition-colors flex items-center justify-center gap-1"><X size={15} /> 반려</button>
                                                    <button onClick={() => handleApprove(popup.id)} className="flex-1 py-2.5 bg-lime-300 text-ink-900 hover:bg-lime-400 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-1"><Check size={15} /> 승인</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ===== 팝업 관리 ===== */}
                        {!isLoading && activeTab === "POPUPS" && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">이미지 없는 팝업은 커버 배정으로 각기 다른 사진을 채웁니다.</p>
                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        onClick={handleDedupe}
                                        disabled={isDeduping}
                                        className="rounded-pill border border-hot-400/60 bg-hot-400/10 px-4 py-2 text-sm font-bold text-hot-500 transition-colors hover:bg-hot-400/20 disabled:opacity-60"
                                    >
                                        {isDeduping ? "정리 중…" : "중복 정리"}
                                    </button>
                                    <button
                                        onClick={handleBackfillPhotos}
                                        disabled={isBackfilling}
                                        className="rounded-pill bg-lime-300 px-4 py-2 text-sm font-bold text-ink-900 transition-colors hover:bg-lime-400 disabled:opacity-60"
                                    >
                                        {isBackfilling ? "배정 중…" : "팝업 사진 채우기"}
                                    </button>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-border)] bg-surface overflow-hidden">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-cream-100 dark:bg-ink-800 text-muted-foreground font-bold border-b border-[var(--color-border)] text-[11px]">
                                            <tr>
                                                <th className="p-4">ID</th>
                                                <th className="p-4">이름</th>
                                                <th className="p-4">상태</th>
                                                <th className="p-4 text-center">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-border)]">
                                            {allPopups.map(p => (
                                                <tr key={p.id} className="hover:bg-foreground/5 transition-colors">
                                                    <td className="p-4 text-muted-foreground font-mono">#{p.id}</td>
                                                    <td className="p-4 font-bold">{p.name}</td>
                                                    <td className="p-4">
                                                        <span className="px-2 py-1 bg-lime-300/15 text-lime-600 dark:bg-ink-800 dark:text-lime-300 rounded-full text-[10px] font-bold">{p.status}</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => handleChangeStatus(p.id, p.status)} className="px-3 py-1 rounded-lg bg-foreground/5 hover:bg-lime-300 hover:text-ink-900 text-xs font-bold transition-all">상태 변경</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {allPopups.length === 0 && (
                                                <tr><td colSpan={4} className="p-16 text-center text-muted-foreground">팝업이 없습니다.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            </div>
                        )}

                        {/* ===== 커뮤니티 관리 ===== */}
                        {!isLoading && activeTab === "MATES" && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {matePosts.length === 0 && (
                                    <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)] text-muted-foreground">게시글이 없습니다.</div>
                                )}
                                {matePosts.map(post => (
                                    <div key={post.id} className="bg-surface p-5 rounded-2xl border border-[var(--color-border)] flex justify-between items-center gap-3 group">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {post.isMegaphone && <span className="text-[10px] bg-hot-100 text-hot-500 px-2 py-0.5 rounded-full font-bold">부스트</span>}
                                                <h3 className="font-bold text-base truncate">{post.title}</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">{post.content}</p>
                                        </div>
                                        <button onClick={() => handleDeleteMatePost(post.id)} className="shrink-0 px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-muted-foreground hover:border-danger hover:text-danger text-xs font-bold transition-all flex items-center gap-1"><Trash2 size={14}/> 삭제</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ===== 라이브 댓글 ===== */}
                        {!isLoading && activeTab === "COMMENTS" && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm text-muted-foreground">실시간 톡방(라이브 댓글) 최근 100건. 개별 또는 일괄 삭제할 수 있어요.</p>
                                    <button onClick={loadComments} className="shrink-0 rounded-pill border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">새로고침</button>
                                </div>

                                {comments.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-cream-100 dark:bg-ink-800/60 px-4 py-2.5">
                                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                                            <input type="checkbox" checked={comments.length > 0 && selectedComments.size === comments.length} onChange={toggleSelectAllComments} className="size-4 accent-lime-500" />
                                            전체 선택
                                            {selectedComments.size > 0 && <span className="text-lime-600 dark:text-lime-300">· {selectedComments.size}개 선택됨</span>}
                                        </label>
                                        <button onClick={handleBulkDeleteComments} disabled={selectedComments.size === 0} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-bold text-danger transition-all hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40">
                                            <Trash2 size={14}/> 선택 삭제{selectedComments.size > 0 ? ` (${selectedComments.size})` : ""}
                                        </button>
                                    </div>
                                )}

                                {comments.length === 0 && (
                                    <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)] text-muted-foreground">댓글이 없습니다.</div>
                                )}
                                {comments.map(c => (
                                    <div key={c.id} className={`flex items-center gap-3 rounded-2xl border bg-surface p-4 ${selectedComments.has(c.id) ? "border-lime-400 ring-1 ring-lime-300/40" : "border-[var(--color-border)]"}`}>
                                        <input type="checkbox" checked={selectedComments.has(c.id)} onChange={() => toggleCommentSelect(c.id)} aria-label="댓글 선택" className="size-4 shrink-0 accent-lime-500" />
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                                <span className="font-bold text-foreground">{c.sender}</span>
                                                {c.popupName && <span className="truncate">· {c.popupName}</span>}
                                                {c.sendTime && <span>· {new Date(c.sendTime).toLocaleString()}</span>}
                                            </div>
                                            <p className="text-sm text-foreground break-all">{c.message}</p>
                                        </div>
                                        <button onClick={() => handleDeleteComment(c.id)} className="shrink-0 px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-muted-foreground hover:border-danger hover:text-danger text-xs font-bold transition-all flex items-center gap-1"><Trash2 size={14}/> 삭제</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ===== 회원 ===== */}
                        {!isLoading && activeTab === "MEMBERS" && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <p className="text-sm font-bold text-muted-foreground mb-4 flex items-center gap-2"><Users size={16} className="text-lime-500"/> 회원 {users.length}명</p>
                                <div className="bg-surface rounded-2xl border border-[var(--color-border)] overflow-hidden">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-cream-100 dark:bg-ink-800 text-muted-foreground text-left text-xs">
                                                    <th className="px-4 py-3 font-bold">닉네임</th>
                                                    <th className="px-4 py-3 font-bold">이메일</th>
                                                    <th className="px-4 py-3 font-bold">가입경로</th>
                                                    <th className="px-4 py-3 font-bold">등급</th>
                                                    <th className="px-4 py-3 font-bold whitespace-nowrap">가입일</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map(u => (
                                                    <tr key={u.userId} className="border-t border-[var(--color-border)] hover:bg-foreground/5 transition-colors">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span className="inline-flex items-center gap-2 font-bold">
                                                                <span className="w-6 h-6 rounded-full bg-lime-300/30 flex items-center justify-center text-[10px] text-lime-700 dark:text-lime-400 font-black shrink-0">{u.nickname?.[0] ?? "?"}</span>
                                                                {u.nickname}
                                                                {u.role === "ROLE_ADMIN" && <span className="text-[9px] bg-hot-100 text-hot-500 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                                                        <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-border)]">{u.provider || "local"}</span></td>
                                                        <td className="px-4 py-3">{u.isPremium ? <span className="text-[11px] text-amber-600 font-bold whitespace-nowrap">👑 프리미엄</span> : <span className="text-[11px] text-muted-foreground">일반</span>}</td>
                                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.createdAt ? new Date(u.createdAt).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                                                    </tr>
                                                ))}
                                                {users.length === 0 && (
                                                    <tr><td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">아직 가입한 회원이 없습니다.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===== 방문 통계 ===== */}
                        {!isLoading && activeTab === "VISITS" && visitStats && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <p className="text-sm text-muted-foreground">익명 집계 · IP 미저장</p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {[
                                        { label: "오늘 방문자", value: visitStats.todayVisitors, sub: "고유" },
                                        { label: "오늘 페이지뷰", value: visitStats.todayPageviews, sub: "" },
                                        { label: "오늘 게스트", value: visitStats.todayGuests, sub: "" },
                                        { label: "오늘 회원", value: visitStats.todayMembers, sub: "" },
                                        { label: "7일 방문자", value: visitStats.weekVisitors, sub: "고유" },
                                    ].map((s) => (
                                        <div key={s.label} className="bg-surface p-4 rounded-2xl border border-[var(--color-border)]">
                                            <p className="text-xs text-muted-foreground">{s.label}</p>
                                            <p className="text-2xl md:text-3xl font-black mt-1">
                                                {s.value.toLocaleString()}
                                                {s.sub && <span className="text-xs font-normal text-muted-foreground ml-1">{s.sub}</span>}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="bg-surface p-5 rounded-2xl border border-[var(--color-border)]">
                                        <h3 className="font-bold text-sm mb-4">최근 7일 방문자</h3>
                                        {visitStats.daily.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-10 text-center">데이터가 아직 없어요.</p>
                                        ) : (
                                            <div className="flex items-end justify-between gap-2 h-40">
                                                {(() => { const max = Math.max(...visitStats.daily.map((x) => x.visitors), 1); return visitStats.daily.map((d) => (
                                                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                                                        <span className="text-[10px] font-bold text-muted-foreground">{d.visitors}</span>
                                                        <div className="w-full bg-lime-300 rounded-t-md" style={{ height: `${(d.visitors / max) * 100}%`, minHeight: d.visitors > 0 ? 4 : 0 }} />
                                                        <span className="text-[9px] text-muted-foreground">{d.date}</span>
                                                    </div>
                                                )); })()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-surface p-5 rounded-2xl border border-[var(--color-border)]">
                                        <h3 className="font-bold text-sm mb-4">인기 페이지 (7일)</h3>
                                        {visitStats.topPaths.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-10 text-center">데이터가 아직 없어요.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {visitStats.topPaths.map((p) => (
                                                    <li key={p.path} className="flex items-center justify-between gap-2 text-sm">
                                                        <span className="truncate text-muted-foreground font-mono text-xs">{p.path}</span>
                                                        <span className="font-bold shrink-0">{p.count.toLocaleString()}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="bg-surface p-5 rounded-2xl border border-[var(--color-border)] lg:col-span-2">
                                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="font-bold text-sm">오늘 방문 경로 <span className="text-muted-foreground font-normal">(봇 제외 · 회원/게스트 구분)</span></h3>
                                            <button onClick={loadVisitStats} className="rounded-pill border border-[var(--color-border)] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground">새로고침</button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mb-3">/login·/admin·/oauth에 <b>회원</b> 뷰가 많으면 본인 접속, /popups·/popup에 <b>게스트</b>가 많으면 외부·검색 유입입니다.</p>
                                        {todayPaths.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-8 text-center">오늘 방문이 아직 없어요.</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {todayPaths.map((p) => (
                                                    <li key={p.path} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] last:border-0 py-1.5 text-sm">
                                                        <span className="truncate font-mono text-xs text-muted-foreground">{p.path}</span>
                                                        <span className="flex shrink-0 items-center gap-1.5 text-xs">
                                                            <span className="font-bold">{p.total}</span>
                                                            {p.members > 0 && <span className="rounded-full bg-lime-300/20 px-2 py-0.5 font-bold text-lime-700 dark:text-lime-300">회원 {p.members}</span>}
                                                            {p.guests > 0 && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-muted-foreground dark:bg-white/10">게스트 {p.guests}</span>}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===== 방문자 목록 ===== */}
                        {!isLoading && activeTab === "VISITORS" && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm text-muted-foreground">최근 7일 방문자 · 봇 제외 · 최근 방문 순 (최대 100명)</p>
                                        <p className="mt-1 text-xs font-bold">게스트 <span className="text-muted-foreground">{visitors.filter(v => v.guest).length}명</span> · 회원 <span className="text-lime-600 dark:text-lime-300">{visitors.filter(v => !v.guest).length}명</span></p>
                                    </div>
                                    <button onClick={loadVisitors} className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">새로고침</button>
                                </div>
                                {visitors.length === 0 ? (
                                    <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-12 text-center text-sm text-muted-foreground">
                                        최근 방문자가 없어요.<span className="mt-1 block text-xs">(백엔드 배포 후 집계됩니다)</span>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface">
                                        {visitors.map((v, i) => (
                                            <li key={v.visitorId || i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${v.guest ? "bg-gray-200 text-muted-foreground dark:bg-white/10" : "bg-lime-300/20 text-lime-700 dark:text-lime-300"}`}>{v.guest ? "게스트" : "회원"}</span>
                                                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={v.paths}>{v.paths}</span>
                                                <span className="shrink-0 text-xs font-bold">{v.visits}회</span>
                                                <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{(v.lastSeen ?? "").slice(5, 16)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* ===== 보상 지급 ===== */}
                        {!isLoading && activeTab === "REWARDS" && (
                            <div className="max-w-md mx-auto bg-surface p-8 rounded-3xl border border-[var(--color-border)] shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 bg-lime-300/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-lime-600 dark:text-lime-300"><Gift size={30}/></div>
                                    <h2 className="text-xl font-black">보상 지급</h2>
                                    <p className="text-xs text-muted-foreground mt-2">보상을 지급할 유저의 닉네임을 정확히 입력하세요.</p>
                                </div>
                                <form onSubmit={handleGiveReward} className="space-y-4">
                                    <input type="text" value={rewardForm.nickname} onChange={e => setRewardForm({...rewardForm, nickname: e.target.value})} placeholder="닉네임 입력" className="w-full bg-cream-100 dark:bg-ink-800 border border-[var(--color-border)] rounded-xl p-3 text-sm outline-none focus:border-lime-400 transition-all"/>
                                    <select value={rewardForm.itemType} onChange={e => setRewardForm({...rewardForm, itemType: e.target.value})} className="w-full bg-cream-100 dark:bg-ink-800 border border-[var(--color-border)] rounded-xl p-3 text-sm outline-none">
                                        <option value="MEGAPHONE">📢 확성기 (MEGAPHONE)</option>
                                        <option value="POPPASS">👑 팝패스 (POP-PASS)</option>
                                    </select>
                                    <input type="number" min="1" value={rewardForm.amount} onChange={e => setRewardForm({...rewardForm, amount: parseInt(e.target.value)})} className="w-full bg-cream-100 dark:bg-ink-800 border border-[var(--color-border)] rounded-xl p-3 text-sm outline-none"/>
                                    <button type="submit" className="w-full py-4 bg-lime-300 hover:bg-lime-400 text-ink-900 font-bold rounded-xl shadow-sm transition-all active:scale-95">지급하기</button>
                                </form>
                            </div>
                        )}

                        {/* ===== 의견 ===== */}
                        {activeTab === "FEEDBACK" && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <AdminFeedbackPanel />
                            </div>
                        )}

                        {/* ===== 시스템 (서버 지표 + 로그) ===== */}
                        {activeTab === "SYSTEM" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                    <MetricCard
                                        label="JVM Heap"
                                        value={Math.round(Number(dashboard.snapshot?.jvm?.heapUsedMb ?? 0))}
                                        unit="MB"
                                        sub={`최대 ${Math.round(Number(dashboard.snapshot?.jvm?.heapMaxMb ?? 0))}MB · Thread ${dashboard.snapshot?.jvm?.threadsLive ?? 0}`}
                                        icon={<Cpu size={24}/>}
                                        tone={
                                            Number(dashboard.snapshot?.jvm?.heapUsedMb ?? 0) /
                                                Math.max(1, Number(dashboard.snapshot?.jvm?.heapMaxMb ?? 1)) > 0.85
                                                ? "danger"
                                                : "ok"
                                        }
                                    />
                                    <MetricCard
                                        label="HTTP 요청"
                                        value={dashboard.snapshot?.http?.requestCount ?? 0}
                                        unit="건"
                                        sub={`p95 ${Number(dashboard.snapshot?.http?.p95Ms ?? 0).toFixed(0)}ms · 5xx ${dashboard.snapshot?.http?.status5xxCount ?? 0}`}
                                        icon={<Globe size={24}/>}
                                        tone={Number(dashboard.snapshot?.http?.errorRate ?? 0) > 0.05 ? "warning" : "neutral"}
                                    />
                                    <MetricCard
                                        label="DB Pool"
                                        value={dashboard.snapshot?.db?.active ?? 0}
                                        unit="active"
                                        sub={`idle ${dashboard.snapshot?.db?.idle ?? 0} · pending ${dashboard.snapshot?.db?.pending ?? 0} / max ${dashboard.snapshot?.db?.max ?? 0}`}
                                        icon={<Database size={24}/>}
                                        tone={Number(dashboard.snapshot?.db?.pending ?? 0) > 0 ? "warning" : "ok"}
                                    />
                                    <MetricCard
                                        label="오늘 자동수집"
                                        value={dashboard.snapshot?.crawler?.crawledToday ?? 0}
                                        unit="건"
                                        sub={`평균 신뢰도 ${dashboard.snapshot?.crawler?.avgConfidence ?? 0} · 검수 대기 ${dashboard.snapshot?.crawler?.pendingReview ?? 0}`}
                                        icon={<Activity size={24}/>}
                                    />
                                </div>

                                <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-sm flex items-center gap-2"><Cpu size={16} className="text-lime-500" /> GCP 서버 실시간 리소스</h3>
                                        <div className="flex gap-3 text-xs font-mono">
                                            <span className="text-lime-600 dark:text-lime-400 font-bold">CPU {cpuNow}%</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">MEM {memNow}MB</span>
                                            <span className={`flex items-center gap-1 ${serverStatus === 'online' ? 'text-green-600' : 'text-red-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />{serverStatus === 'online' ? '정상' : '오프라인'}</span>
                                        </div>
                                    </div>
                                    <div className="h-48 flex items-end justify-between gap-1.5">
                                        {realtimeMetrics.length === 0 ? (
                                            <p className="w-full text-center text-sm text-muted-foreground py-16">실시간 데이터를 기다리는 중…</p>
                                        ) : (() => {
                                            const maxMem = Math.max(...realtimeMetrics.map((m) => m.memory), 1);
                                            return realtimeMetrics.map((m, i) => (
                                                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${m.time} · CPU ${m.cpu}% · MEM ${m.memory}MB`}>
                                                    <div className="w-full bg-lime-300 rounded-t-sm" style={{ height: `${(m.memory / maxMem) * 100}%`, minHeight: 2 }} />
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Activity size={16} className="text-lime-500" /> 실시간 로그</h3>
                                    <LogViewer active={true} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

/** 대시보드 서비스 지표 카드. tone 으로 아이콘/값 강조색만 바꾼다. */
function StatCard({
    label,
    value,
    sub,
    icon,
    tone,
}: {
    label: string;
    value: number;
    sub: string;
    icon: ReactNode;
    tone: "lime" | "green" | "amber" | "violet";
}) {
    const toneCls: Record<string, string> = {
        lime: "bg-lime-300/20 text-lime-600 dark:text-lime-300",
        green: "bg-green-100 text-green-600 dark:bg-green-900/25 dark:text-green-400",
        amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400",
        violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/25 dark:text-violet-400",
    };
    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-4 md:p-5">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground">{label}</p>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneCls[tone]}`}>{icon}</span>
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight">{value.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
        </div>
    );
}
