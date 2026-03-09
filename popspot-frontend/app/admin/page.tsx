"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { 
    Check, X, ShieldCheck, MapPin, Calendar, Store, AlertCircle, 
    BarChart3, Users, MessageSquare, Gift, Trash2, Edit3, Activity, Cpu, HardDrive 
} from "lucide-react";
import Swal from "sweetalert2";

// 🔥 [통합] 기존 차트 + 실시간 선 그래프(LineChart) 컴포넌트 추가
import { 
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line 
} from 'recharts';

// 🔥 apiFetch 경로를 확인해주세요!
import { apiFetch } from "../../src/lib/api"; 

// 📊 실시간 지표 데이터 타입
interface MetricData {
    time: string;
    cpu: number;
    memory: number;
}

export default function AdminPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("DASHBOARD");
    const [isLoading, setIsLoading] = useState(true);

    // 데이터 상태들
    const [stats, setStats] = useState<any>(null);
    const [pendingPopups, setPendingPopups] = useState<any[]>([]);
    const [allPopups, setAllPopups] = useState<any[]>([]);
    const [matePosts, setMatePosts] = useState<any[]>([]);
    
    // 🔥 [신규] 실시간 서버 지표 상태
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

    // 🔥 [신규] 서버 리소스 실시간 폴링 (3초 주기)
    useEffect(() => {
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
                        return updated.slice(-15); // 최근 15개 데이터 유지
                    });
                } else {
                    setServerStatus('offline');
                }
            } catch (e) {
                setServerStatus('offline');
            }
        };

        const interval = setInterval(fetchMetrics, 3000);
        return () => clearInterval(interval);
    }, [activeTab]);

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

    // 탭 변경 시 데이터 로딩
    useEffect(() => {
        if (activeTab === "DASHBOARD") loadDashboardData();
        else if (activeTab === "POPUPS") loadAllPopups();
        else if (activeTab === "MATES") loadMatePosts();
    }, [activeTab]);

    // ================= [API 기능 핸들러] =================
    // (기존 핸들러 로직 유지됨)
    const handleApprove = async (id: number) => {
        if (!confirm("승인하시겠습니까?")) return;
        try {
            const res = await apiFetch(`/api/admin/popups/${id}/approve`, { method: "POST" });
            if (res.ok) { Swal.fire('승인 완료!', '', 'success'); loadDashboardData(); }
        } catch (e) { Swal.fire('오류', '', 'error'); }
    };

    const handleReject = async (id: number) => {
        if (!confirm("거절하시겠습니까?")) return;
        try {
            const res = await apiFetch(`/api/admin/popups/${id}/reject`, { method: "DELETE" });
            if (res.ok) { Swal.fire('삭제 완료', '', 'success'); loadDashboardData(); }
        } catch (e) { Swal.fire('오류', '', 'error'); }
    };

    const handleChangeStatus = async (id: number, currentStatus: string) => {
        const { value: newStatus } = await Swal.fire({
            title: '상태 변경',
            input: 'select',
            inputOptions: { '영업중': '영업중', '혼잡': '혼잡', '종료': '종료' },
            showCancelButton: true,
            inputValue: currentStatus
        });
        if (newStatus) {
            try {
                const res = await apiFetch(`/api/admin/popups/${id}/status?status=${newStatus}`, { method: "PATCH" });
                if (res.ok) { Swal.fire('변경 완료!', '', 'success'); loadAllPopups(); }
            } catch (e) { Swal.fire('오류', '', 'error'); }
        }
    };

    const handleDeleteMatePost = async (id: number) => {
        if (!confirm("삭제하시겠습니까?")) return;
        try {
            const res = await apiFetch(`/api/admin/mate-posts/${id}`, { method: "DELETE" });
            if (res.ok) { Swal.fire('삭제 완료', '', 'success'); loadMatePosts(); }
        } catch (e) { Swal.fire('오류', '', 'error'); }
    };

    const handleGiveReward = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiFetch("/api/admin/reward", {
                method: "POST",
                body: JSON.stringify(rewardForm)
            });
            if (res.ok) { 
                Swal.fire('지급 완료!', '', 'success'); 
                setRewardForm({ nickname: "", itemType: "MEGAPHONE", amount: 1 }); 
            } else { 
                Swal.fire('실패', await res.text(), 'error'); 
            }
        } catch (e) { Swal.fire('오류', '', 'error'); }
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] p-4 md:p-8 text-gray-900 dark:text-white pb-24">
            <div className="max-w-7xl mx-auto">
                
                {/* 헤더 & 네비게이션 */}
                <header className="mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-indigo-600 dark:text-indigo-400 w-10 h-10" />
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
                            { id: "POPUPS", label: "팝업스토어 제어", icon: <Store size={16}/> },
                            { id: "MATES", label: "커뮤니티 관리", icon: <MessageSquare size={16}/> },
                            { id: "REWARDS", label: "이벤트 보상 지급", icon: <Gift size={16}/> },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                                    activeTab === tab.id 
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" 
                                    : "bg-white text-gray-600 border border-gray-200 dark:bg-[#1a1a1a] dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                                }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </header>

                {isLoading && (
                    <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
                )}

                {/* 탭 1: 대시보드 & 제보 관리 */}
                {!isLoading && activeTab === "DASHBOARD" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* 🔥 [핵심 추가] 0. 실시간 서버 리소스 모니터링 섹션 */}
                        <div className="bg-white dark:bg-[#111] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                        <Activity className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <h3 className="font-bold text-lg">GCP 서버 실시간 리소스</h3>
                                    <span className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                </div>
                                <div className="flex gap-4 text-xs font-mono">
                                    <span className="text-indigo-500 font-bold">CPU: {realtimeMetrics[realtimeMetrics.length - 1]?.cpu || 0}%</span>
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
                                <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">총 가입 유저</p><h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.totalUsers}</h3></div>
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-500"><Users size={24}/></div>
                                </div>
                                <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">영업중 팝업</p><h3 className="text-3xl font-black text-green-600 dark:text-green-400">{stats.activePopups}</h3></div>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-500"><Store size={24}/></div>
                                </div>
                                <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">메이트 게시글</p><h3 className="text-3xl font-black text-blue-600 dark:text-blue-400">{stats.totalMatePosts}</h3></div>
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-500"><MessageSquare size={24}/></div>
                                </div>
                                <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-center justify-between">
                                    <div><p className="text-xs text-gray-500 font-bold mb-1">승인 대기중</p><h3 className="text-3xl font-black text-yellow-600 dark:text-yellow-400">{stats.pendingPopups}</h3></div>
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-yellow-500"><AlertCircle size={24}/></div>
                                </div>
                            </div>
                        )}

                        {/* 2. 데이터 시각화 차트 영역 */}
                        {stats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 mb-4 text-center text-indigo-400 italic">"POP-UP STATUS"</h3>
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
                                <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 mb-4 text-center text-indigo-400 italic">"ACTIVITY METRICS"</h3>
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
                                <div className="col-span-2 text-center py-20 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-dashed border-gray-300 dark:border-white/10 text-gray-400">대기 중인 제보가 없습니다.</div>
                            ) : (
                                pendingPopups.map((popup) => (
                                    <div key={popup.id} className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-md flex flex-col justify-between hover:border-indigo-500/50 transition-all">
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
                                            <button onClick={() => handleApprove(popup.id)} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-sm transition-colors shadow-lg uppercase">Approve</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* 탭 2: 전체 팝업 제어 */}
                {!isLoading && activeTab === "POPUPS" && (
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase">{p.status}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleChangeStatus(p.id, p.status)} className="px-3 py-1 bg-gray-100 dark:bg-white/10 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-all uppercase">Edit</button>
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
                            <div key={post.id} className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 flex justify-between items-center group">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        {post.isMegaphone && <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">Megaphone</span>}
                                        <h3 className="font-bold text-lg">{post.title}</h3>
                                    </div>
                                    <p className="text-sm text-gray-500">{post.content}</p>
                                </div>
                                <button onClick={() => handleDeleteMatePost(post.id)} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold transition-all uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100"><Trash2 size={14}/> Delete</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* 탭 4: 보상 수동 지급 */}
                {!isLoading && activeTab === "REWARDS" && (
                    <div className="max-w-md mx-auto bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Gift size={32}/></div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Reward System</h2>
                            <p className="text-xs text-gray-500 mt-2 italic">보상을 지급할 유저의 닉네임을 정확히 입력하세요.</p>
                        </div>
                        <form onSubmit={handleGiveReward} className="space-y-5">
                            <input type="text" value={rewardForm.nickname} onChange={e => setRewardForm({...rewardForm, nickname: e.target.value})} placeholder="닉네임 입력" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none focus:ring-2 ring-indigo-500/50 transition-all"/>
                            <select value={rewardForm.itemType} onChange={e => setRewardForm({...rewardForm, itemType: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none">
                                <option value="MEGAPHONE">📢 확성기 (MEGAPHONE)</option>
                                <option value="POPPASS">👑 팝패스 (POP-PASS)</option>
                            </select>
                            <input type="number" min="1" value={rewardForm.amount} onChange={e => setRewardForm({...rewardForm, amount: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none"/>
                            <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 uppercase">Send Reward</button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}