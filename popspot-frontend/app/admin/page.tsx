"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
    Check, X, ShieldCheck, MapPin, Calendar, Store, AlertCircle,
    BarChart3, Users, MessageSquare, Gift, Trash2, Edit3, Activity, Cpu, HardDrive,
    Terminal, Database, Globe, Sparkles, Inbox
} from "lucide-react";
import Swal from "sweetalert2";

import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';

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

export default function AdminPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("DASHBOARD");
    const [isLoading, setIsLoading] = useState(true);

    /*
     * v2.13.3 — role 게이트 (v2.13.3.1 핫픽스: 강건성 + redirect 경로 수정).
     *
     * 일반 유저가 /admin URL 로 진입하면 페이지 자체는 로드되지만 메트릭 polling +
     * SSE 로그 스트림이 모두 ADMIN 가드라 즉시 403 도배가 발생했다. 백엔드 로그에
     * AuthorizationDeniedException 이 100+ 줄 stack trace 로 매 요청마다 찍히고,
     * "response already committed" 후속 에러까지 동반.
     *
     * 핫픽스: mount 시점에 localStorage 의 user.role 을 검사해 ADMIN 이 아니면 polling/
     * SSE 가 시작되기 전에 메인으로 리다이렉트한다. 서버 권한은 별도로 토큰 검증으로
     * 강제되어 있으므로 이 클라이언트 가드는 UX + 로그 노이즈 방지 목적.
     *
     * 강건성 — DB 의 role 값이 환경별로 "ROLE_ADMIN" / "ADMIN" 둘 다 존재할 수 있어
     * 대문자화 후 두 변형 모두 통과시킨다.
     *
     * 리다이렉트 경로 — 관리자 권한이 없으면 메인("/")으로 돌려보낸다.
     */
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem("user");
            if (!raw) {
                router.replace("/login");
                return;
            }
            const parsed = JSON.parse(raw) as { role?: string };
            const role = (parsed.role ?? "").trim().toUpperCase();
            const isAdmin = role === "ROLE_ADMIN" || role === "ADMIN";
            if (!isAdmin) {
                router.replace("/");
                return;
            }
            setAuthorized(true);
        } catch {
            router.replace("/login");
        }
    }, [router]);

    const [stats, setStats] = useState<AdminStats | null>(null);
    const [pendingPopups, setPendingPopups] = useState<PopupStore[]>([]);
    const [allPopups, setAllPopups] = useState<PopupStore[]>([]);
    const [matePosts, setMatePosts] = useState<AdminMatePost[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [visitStats, setVisitStats] = useState<AdminVisitStats | null>(null);

    // v2.10 — 통합 메트릭 폴링. DASHBOARD 탭일 때만 실제 폴링 (다른 탭에선 훅이 effect cleanup).
    // v2.13.3 — authorized 가 true 가 되기 전엔 폴링 자체를 시작하지 않아 403 도배 차단.
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

    // 1. 초기 데이터 로딩 (통계 및 대기열)
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
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!authorized) return; // v2.13.3 — role 검증 전엔 폴링 차단
        if (activeTab !== "DASHBOARD") return; // 대시보드 탭일 때만 작동해서 부하 감소

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
        } catch (e) {} finally { setIsLoading(false); }
    };

    // 탭 변경 시 데이터 로딩
    useEffect(() => {
        if (!authorized) return; // v2.13.3 — role 검증 전엔 admin fetch 차단
        if (activeTab === "DASHBOARD") loadDashboardData();
        else if (activeTab === "POPUPS") loadAllPopups();
        else if (activeTab === "MATES") loadMatePosts();
        else if (activeTab === "MEMBERS") loadUsers();
        else if (activeTab === "VISITS") loadVisitStats();
    }, [activeTab, authorized]);

    // ================= [API 기능 핸들러] =================
    // (기존 핸들러 로직 유지됨)
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
     * 단순 토스트/confirm 은 notify 추상화로 일원화했지만, 커스텀 select 다이얼로그는 notify 가
     * 아직 지원하지 않으므로 예외적으로 Swal 직접 호출을 유지한다.
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

    // 차트 데이터 가공
    const COLORS = ['#10b981', '#f59e0b'];
    const pieData = stats ? [
        { name: '영업중 팝업', value: stats.activePopups },
        { name: '승인 대기중', value: stats.pendingPopups }
    ] : [];

    const barData = stats ? [
        { name: '가입 유저', count: stats.totalUsers },
        { name: '게시글', count: stats.totalMatePosts }
    ] : [];

    if (!authorized) {
        // v2.13.3 — role 검증 중 / 비ADMIN 사용자 진입 시. router.replace 가 곧 떠나게 만들지만,
        // 첫 paint 에서 admin UI 가 잠깐 보이지 않도록 단순 로더로 가린다.
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-ink-900 text-gray-500">
                <span className="text-sm">권한 확인 중...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-ink-900 p-4 md:p-8 text-gray-900 dark:text-white pb-24">
            <div className="max-w-7xl mx-auto">

                {/* 헤더 & 네비게이션 */}
                <header className="mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-lime-500 w-10 h-10" />
                            <div>
                                <h1 className="text-2xl md:text-4xl font-black tracking-tight uppercase">Master Admin</h1>
                                <p className="text-sm text-gray-500">POP-SPOT 시스템 통합 관리</p>
                            </div>
                        </div>
                        <button onClick={() => router.push("/")} className="px-4 py-2 bg-gray-200 dark:bg-white/10 rounded-xl font-bold text-sm hover:bg-gray-300 dark:hover:bg-white/20 transition-colors">
                            서비스로 돌아가기
                        </button>
                    </div>

                    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                        {[
                            { id: "DASHBOARD", label: "요약 & 제보관리", icon: <BarChart3 size={16}/> },
                            { id: "MEMBERS", label: "회원 목록", icon: <Users size={16}/> },
                            { id: "VISITS", label: "방문 통계", icon: <Globe size={16}/> },
                            { id: "POPUPS", label: "팝업스토어 제어", icon: <Store size={16}/> },
                            { id: "MATES", label: "커뮤니티 관리", icon: <MessageSquare size={16}/> },
                            { id: "REWARDS", label: "이벤트 보상 지급", icon: <Gift size={16}/> },
                            { id: "FEEDBACK", label: "의견 보내기", icon: <Inbox size={16}/> },
                            { id: "LOGS", label: "실시간 로그", icon: <Terminal size={16}/> },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                                    activeTab === tab.id 
                                    ? "bg-lime-300 text-ink-900 shadow-md" 
                                    : "bg-white text-gray-600 border border-gray-200 dark:bg-ink-700 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                                }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </header>

                {isLoading && (
                    <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full"></div></div>
                )}

                {/* 탭 1: 대시보드 & 제보 관리 */}
                {!isLoading && activeTab === "DASHBOARD" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        
                        <div className="bg-white dark:bg-ink-700 p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-lime-300/10 rounded-lg">
                                        <Activity className="w-5 h-5 text-lime-500" />
                                    </div>
                                    <h3 className="font-bold text-lg">GCP 서버 실시간 리소스</h3>
                                    <span className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                </div>
                                <div className="flex gap-4 text-xs font-mono">
                                    <span className="text-lime-500 font-bold">CPU: {realtimeMetrics[realtimeMetrics.length - 1]?.cpu || 0}%</span>
                                    <span className="text-emerald-500 font-bold">MEM: {realtimeMetrics[realtimeMetrics.length - 1]?.memory || 0} MB</span>
                                </div>
                            </div>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={realtimeMetrics}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                        <XAxis dataKey="time" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                        <Line type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} name="CPU %" />
                                        <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} name="Memory MB" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 1. 통계 요약 텍스트 박스 */}
                        {stats && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">총 가입 유저</p><h3 className="text-3xl font-black text-lime-500">{stats.totalUsers}</h3></div>
                                    <div className="p-3 bg-lime-300/10 dark:bg-ink-800 rounded-xl text-lime-500"><Users size={24}/></div>
                                </div>
                                <div className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">영업중 팝업</p><h3 className="text-3xl font-black text-green-600 dark:text-green-400">{stats.activePopups}</h3></div>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-500"><Store size={24}/></div>
                                </div>
                                <div className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">메이트 게시글</p><h3 className="text-3xl font-black text-blue-600 dark:text-blue-400">{stats.totalMatePosts}</h3></div>
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-500"><MessageSquare size={24}/></div>
                                </div>
                                <div className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">승인 대기중</p><h3 className="text-3xl font-black text-yellow-600 dark:text-yellow-400">{stats.pendingPopups}</h3></div>
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-yellow-500"><AlertCircle size={24}/></div>
                                </div>
                            </div>
                        )}

                        {/*
                          v2.10 — 통합 메트릭 카드. JVM / HTTP / DB / 자동수집 한 줄에 한눈에.
                          각 카드는 MetricCard 추상화 1개로 통일 — 추후 새 카드 추가가 1줄로 끝나도록.
                        */}
                        <h2 className="text-xl font-bold flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-white/10">
                            <Activity className="text-lime-500"/> 시스템 메트릭
                            <span className={`ml-2 w-2 h-2 rounded-full ${dashboard.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                icon={<Sparkles size={24}/>}
                            />
                        </div>

                        {/* 2. 데이터 시각화 차트 영역 */}
                        {stats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-ink-700 p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 mb-4 text-center text-lime-300 italic">"POP-UP STATUS"</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {pieData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <RechartsTooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-ink-700 p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 mb-4 text-center text-lime-300 italic">"ACTIVITY METRICS"</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={barData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <RechartsTooltip />
                                                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. 제보 대기열 리스트 */}
                        <h2 className="text-xl font-bold flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-white/10"><AlertCircle className="text-yellow-500"/> 제보 승인 대기열</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pendingPopups.length === 0 ? (
                                <div className="col-span-2 text-center py-20 bg-white dark:bg-ink-700 rounded-2xl border border-dashed border-gray-300 dark:border-white/10 text-gray-400">대기 중인 제보가 없습니다.</div>
                            ) : (
                                pendingPopups.map((popup) => (
                                    <div key={popup.id} className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-md flex flex-col justify-between hover:border-lime-300/50 transition-all">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500 text-[10px] font-bold rounded">PENDING</span>
                                                <span className="text-xs text-gray-400 font-mono">ID: {popup.reporterId}</span>
                                            </div>
                                            <h3 className="text-lg font-black mb-2 truncate uppercase">{popup.name}</h3>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><MapPin size={12}/> {popup.location}</p>
                                        </div>
                                        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                                            <button onClick={() => handleReject(popup.id)} className="flex-1 py-2.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white dark:bg-red-900/20 rounded-xl font-bold text-sm transition-colors uppercase">Reject</button>
                                            <button onClick={() => handleApprove(popup.id)} className="flex-1 py-2.5 bg-lime-300 text-ink-900 hover:bg-lime-400 rounded-xl font-bold text-sm transition-colors shadow-lg uppercase">Approve</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* 탭 2: 전체 팝업 제어 */}
                {!isLoading && activeTab === "POPUPS" && (
                    <div className="bg-white dark:bg-ink-700 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-black/50 text-gray-600 font-bold border-b border-gray-200 dark:border-white/5 uppercase text-[11px]">
                                <tr>
                                    <th className="p-4">ID</th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {allPopups.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-gray-400 font-mono">#{p.id}</td>
                                        <td className="p-4 font-bold">{p.name}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-lime-300/15 text-lime-500 dark:bg-ink-800 dark:text-lime-300 rounded-full text-[10px] font-bold uppercase">{p.status}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleChangeStatus(p.id, p.status)} className="px-3 py-1 bg-gray-100 dark:bg-white/10 hover:bg-lime-400 hover:text-white rounded-lg text-xs font-bold transition-all uppercase">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 탭 3: 커뮤니티 관리 */}
                {!isLoading && activeTab === "MATES" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {matePosts.map(post => (
                            <div key={post.id} className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5 flex justify-between items-center group">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        {post.isMegaphone && <span className="text-[10px] bg-hot-100 text-hot-500 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">Megaphone</span>}
                                        <h3 className="font-bold text-lg">{post.title}</h3>
                                    </div>
                                    <p className="text-sm text-gray-500">{post.content}</p>
                                </div>
                                <button onClick={() => handleDeleteMatePost(post.id)} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold transition-all uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100"><Trash2 size={14}/> Delete</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* 탭: 회원 목록 — 가입자 조회 (닉네임/이메일/가입경로/등급/가입일) */}
                {!isLoading && activeTab === "MEMBERS" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 mb-4"><Users size={18} className="text-lime-500"/> 회원 {users.length}명</h2>
                        <div className="bg-white dark:bg-ink-700 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-ink-800 text-gray-500 text-left text-xs uppercase tracking-wider">
                                            <th className="px-4 py-3 font-bold">닉네임</th>
                                            <th className="px-4 py-3 font-bold">이메일</th>
                                            <th className="px-4 py-3 font-bold">가입경로</th>
                                            <th className="px-4 py-3 font-bold">등급</th>
                                            <th className="px-4 py-3 font-bold whitespace-nowrap">가입일</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.userId} className="border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-2 font-bold">
                                                        <span className="w-6 h-6 rounded-full bg-lime-300/30 flex items-center justify-center text-[10px] text-lime-700 dark:text-lime-400 font-black shrink-0">{u.nickname?.[0] ?? "?"}</span>
                                                        {u.nickname}
                                                        {u.role === "ROLE_ADMIN" && <span className="text-[9px] bg-hot-100 text-hot-500 px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                                                <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 uppercase">{u.provider || "local"}</span></td>
                                                <td className="px-4 py-3">{u.isPremium ? <span className="text-[11px] text-amber-600 font-bold whitespace-nowrap">👑 프리미엄</span> : <span className="text-[11px] text-gray-400">일반</span>}</td>
                                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{u.createdAt ? new Date(u.createdAt).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                                            </tr>
                                        ))}
                                        {users.length === 0 && (
                                            <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-400">아직 가입한 회원이 없습니다.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 탭: 방문 통계 — 익명 방문 로그 집계 (게스트 포함, IP 미저장) */}
                {!isLoading && activeTab === "VISITS" && visitStats && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            <Globe size={18} className="text-lime-500"/> 방문 통계
                            <span className="text-xs font-normal text-gray-400 normal-case">· 익명 집계 (IP 미저장)</span>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { label: "오늘 방문자", value: visitStats.todayVisitors, sub: "고유" },
                                { label: "오늘 페이지뷰", value: visitStats.todayPageviews, sub: "" },
                                { label: "오늘 게스트", value: visitStats.todayGuests, sub: "" },
                                { label: "오늘 회원", value: visitStats.todayMembers, sub: "" },
                                { label: "7일 방문자", value: visitStats.weekVisitors, sub: "고유" },
                            ].map((s) => (
                                <div key={s.label} className="bg-white dark:bg-ink-700 p-4 rounded-2xl border border-gray-200 dark:border-white/5">
                                    <p className="text-xs text-gray-500">{s.label}</p>
                                    <p className="text-2xl md:text-3xl font-black mt-1">
                                        {s.value.toLocaleString()}
                                        {s.sub && <span className="text-xs font-normal text-gray-400 ml-1">{s.sub}</span>}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5">
                                <h3 className="font-bold text-sm mb-4">최근 7일 방문자</h3>
                                {visitStats.daily.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-10 text-center">데이터가 아직 없어요.</p>
                                ) : (
                                    <div className="flex items-end justify-between gap-2 h-40">
                                        {(() => { const max = Math.max(...visitStats.daily.map((x) => x.visitors), 1); return visitStats.daily.map((d) => (
                                            <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                                                <span className="text-[10px] font-bold text-gray-500">{d.visitors}</span>
                                                <div className="w-full bg-lime-300 rounded-t-md" style={{ height: `${(d.visitors / max) * 100}%`, minHeight: d.visitors > 0 ? 4 : 0 }} />
                                                <span className="text-[9px] text-gray-400">{d.date}</span>
                                            </div>
                                        )); })()}
                                    </div>
                                )}
                            </div>
                            <div className="bg-white dark:bg-ink-700 p-5 rounded-2xl border border-gray-200 dark:border-white/5">
                                <h3 className="font-bold text-sm mb-4">인기 페이지 (7일)</h3>
                                {visitStats.topPaths.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-10 text-center">데이터가 아직 없어요.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {visitStats.topPaths.map((p) => (
                                            <li key={p.path} className="flex items-center justify-between gap-2 text-sm">
                                                <span className="truncate text-gray-600 dark:text-gray-300 font-mono text-xs">{p.path}</span>
                                                <span className="font-bold shrink-0">{p.count.toLocaleString()}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 탭 4: 보상 수동 지급 */}
                {!isLoading && activeTab === "REWARDS" && (
                    <div className="max-w-md mx-auto bg-white dark:bg-ink-700 p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-lime-300/15 dark:bg-ink-800 rounded-full flex items-center justify-center mx-auto mb-4 text-lime-500"><Gift size={32}/></div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Reward System</h2>
                            <p className="text-xs text-gray-500 mt-2 italic">보상을 지급할 유저의 닉네임을 정확히 입력하세요.</p>
                        </div>
                        <form onSubmit={handleGiveReward} className="space-y-5">
                            <input type="text" value={rewardForm.nickname} onChange={e => setRewardForm({...rewardForm, nickname: e.target.value})} placeholder="닉네임 입력" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none focus:ring-2 ring-lime-300/50 transition-all"/>
                            <select value={rewardForm.itemType} onChange={e => setRewardForm({...rewardForm, itemType: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none">
                                <option value="MEGAPHONE">📢 확성기 (MEGAPHONE)</option>
                                <option value="POPPASS">👑 팝패스 (POP-PASS)</option>
                            </select>
                            <input type="number" min="1" value={rewardForm.amount} onChange={e => setRewardForm({...rewardForm, amount: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none"/>
                            <button type="submit" className="w-full py-4 bg-lime-300 hover:bg-lime-400 text-ink-900 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 uppercase">Send Reward</button>
                        </form>
                    </div>
                )}

                {/* 탭: 의견 보내기 (v2.11) — 사용자가 보낸 의견 검수 / 답변 / 상태 변경 */}
                {activeTab === "FEEDBACK" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <AdminFeedbackPanel />
                    </div>
                )}

                {/* 탭 5: 실시간 로그 (v2.10) — SSE 구독, LOGS 탭 + ADMIN role 일 때만 EventSource 생성 */}
                {activeTab === "LOGS" && authorized && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <LogViewer active={true} />
                    </div>
                )}
            </div>
        </div>
    );
}
