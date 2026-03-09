"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
    Check, X, ShieldCheck, MapPin, Calendar, Store, AlertCircle, 
    BarChart3, Users, MessageSquare, Gift, Trash2, Edit3 
} from "lucide-react";
import Swal from "sweetalert2";

// 🔥 [임의 추가] 예쁜 차트를 그리기 위한 recharts 라이브러리 컴포넌트 임포트
import { 
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';

// 🔥 apiFetch 경로를 동현님 프로젝트 구조에 맞게 확인해주세요! (일반적으로 ../../src/lib/api 또는 ../src/lib/api)
import { apiFetch } from "../../src/lib/api"; 

export default function AdminPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("DASHBOARD");
    const [isLoading, setIsLoading] = useState(true);

    // 데이터 상태들
    const [stats, setStats] = useState<any>(null);
    const [pendingPopups, setPendingPopups] = useState<any[]>([]);
    const [allPopups, setAllPopups] = useState<any[]>([]);
    const [matePosts, setMatePosts] = useState<any[]>([]);

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

    // 2. 전체 팝업 로딩 (상태 변경용)
    const loadAllPopups = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch("/api/admin/popups/all");
            if (res.ok) setAllPopups(await res.json());
        } catch (e) {} finally { setIsLoading(false); }
    };

    // 3. 메이트 게시글 로딩 (삭제용)
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

    const handleApprove = async (id: number) => {
        if (!confirm("승인하시겠습니까? (제보자에게 확성기가 자동 지급됩니다)")) return;
        try {
            const res = await apiFetch(`/api/admin/popups/${id}/approve`, { method: "POST" });
            if (res.ok) {
                Swal.fire({ icon: 'success', title: '승인 완료!' });
                loadDashboardData();
            }
        } catch (e) { Swal.fire({ icon: 'error', title: '오류 발생' }); }
    };

    const handleReject = async (id: number) => {
        if (!confirm("정말 거절하고 삭제하시겠습니까?")) return;
        try {
            const res = await apiFetch(`/api/admin/popups/${id}/reject`, { method: "DELETE" });
            if (res.ok) {
                Swal.fire('삭제 완료', '', 'success');
                loadDashboardData();
            }
        } catch (e) { Swal.fire({ icon: 'error', title: '오류 발생' }); }
    };

    const handleChangeStatus = async (id: number, currentStatus: string) => {
        const { value: newStatus } = await Swal.fire({
            title: '상태 변경',
            input: 'select',
            inputOptions: { '영업중': '영업중 (OPEN)', '혼잡': '혼잡 (BUSY)', '종료': '종료 (CLOSED)' },
            inputPlaceholder: '새로운 상태를 선택하세요',
            showCancelButton: true,
            inputValue: currentStatus
        });

        if (newStatus) {
            try {
                const res = await apiFetch(`/api/admin/popups/${id}/status?status=${newStatus}`, { method: "PATCH" });
                if (res.ok) {
                    Swal.fire('변경 완료!', `상태가 ${newStatus}로 변경되었습니다.`, 'success');
                    loadAllPopups();
                }
            } catch (e) { Swal.fire('오류', '상태 변경 실패', 'error'); }
        }
    };

    const handleDeleteMatePost = async (id: number) => {
        if (!confirm("이 게시글을 강제 삭제하시겠습니까?")) return;
        try {
            const res = await apiFetch(`/api/admin/mate-posts/${id}`, { method: "DELETE" });
            if (res.ok) {
                Swal.fire('삭제 완료', '', 'success');
                loadMatePosts();
            }
        } catch (e) { Swal.fire('오류', '삭제 실패', 'error'); }
    };

    const handleGiveReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rewardForm.nickname) return Swal.fire('입력 오류', '닉네임을 입력하세요.', 'warning');

        try {
            const res = await apiFetch("/api/admin/reward", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rewardForm)
            });
            if (res.ok) {
                Swal.fire('지급 완료!', `${rewardForm.nickname}님에게 보상이 지급되었습니다.`, 'success');
                setRewardForm({ nickname: "", itemType: "MEGAPHONE", amount: 1 });
            } else {
                const err = await res.text();
                Swal.fire('지급 실패', err, 'error');
            }
        } catch (e) { Swal.fire('오류', '서버 통신 실패', 'error'); }
    };

    // 🔥 [임의 추가] 차트 렌더링을 위한 데이터 가공 로직
    const COLORS = ['#10b981', '#f59e0b']; // 초록색(영업중), 노란색(대기중) 색상 지정
    const pieData = stats ? [
        { name: '영업중 팝업', value: stats.activePopups },
        { name: '승인 대기중', value: stats.pendingPopups }
    ] : [];

    const barData = stats ? [
        { name: '가입 유저 수', count: stats.totalUsers },
        { name: '게시글 수', count: stats.totalMatePosts }
    ] : [];

    // ================= [UI 렌더링] =================

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] p-4 md:p-8 text-gray-900 dark:text-white pb-24">
            <div className="max-w-7xl mx-auto">
                
                {/* 헤더 & 네비게이션 */}
                <header className="mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-indigo-600 dark:text-indigo-400 w-10 h-10" />
                            <div>
                                <h1 className="text-2xl md:text-4xl font-black tracking-tight">MASTER ADMIN</h1>
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
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-[#1a1a1a] dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
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

                        {/* 🔥 [임의 추가] 2. 데이터 시각화 차트 영역 */}
                        {stats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 도넛 차트: 팝업스토어 현황 */}
                                <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 mb-4 text-center">팝업스토어 상태 현황</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                                <Legend verticalAlign="bottom" height={36}/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* 막대 차트: 콘텐츠 현황 */}
                                <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 mb-4 text-center">서비스 활성도 지표</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
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
                                    <div key={popup.id} className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-md flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500 text-[10px] font-bold rounded">대기중</span>
                                                <span className="text-xs text-gray-400 font-mono">제보자: {popup.reporterId}</span>
                                            </div>
                                            <h3 className="text-lg font-black mb-2 truncate">{popup.name}</h3>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><MapPin size={12}/> {popup.location}</p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-1"><Calendar size={12}/> {popup.startDate} ~ {popup.endDate}</p>
                                        </div>
                                        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                                            <button onClick={() => handleReject(popup.id)} className="flex-1 py-2.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white dark:bg-red-900/20 dark:text-red-400 rounded-xl font-bold text-sm transition-colors">거절 (삭제)</button>
                                            <button onClick={() => handleApprove(popup.id)} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-sm transition-colors shadow-lg">승인 (보상)</button>
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 dark:bg-black/50 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-white/5">
                                    <tr>
                                        <th className="p-4">ID</th>
                                        <th className="p-4">팝업 이름</th>
                                        <th className="p-4">지역</th>
                                        <th className="p-4">현재 상태</th>
                                        <th className="p-4 text-center">액션</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {allPopups.map(popup => (
                                        <tr key={popup.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-gray-400">#{popup.id}</td>
                                            <td className="p-4 font-bold max-w-[200px] truncate">{popup.name}</td>
                                            <td className="p-4 text-gray-500">{popup.location}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                    popup.status === '영업중' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 
                                                    popup.status === '혼잡' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' : 
                                                    popup.status === '종료' ? 'bg-gray-200 text-gray-600 dark:bg-gray-800' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {popup.status || '상태 없음'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleChangeStatus(popup.id, popup.status)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 mx-auto">
                                                    <Edit3 size={12}/> 상태 변경
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 탭 3: 커뮤니티 관리 */}
                {!isLoading && activeTab === "MATES" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {matePosts.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 bg-white dark:bg-[#1a1a1a] rounded-2xl">게시글이 없습니다.</div>
                        ) : (
                            matePosts.map(post => (
                                <div key={post.id} className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            {post.isMegaphone && <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded font-bold">확성기</span>}
                                            <h3 className="font-bold text-lg">{post.title}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-2">{post.content}</p>
                                        <div className="text-xs text-gray-400 flex items-center gap-3">
                                            <span>작성자: {post.author?.nickname || '알 수 없음'}</span>
                                            <span>인원: {post.currentPeople}/{post.maxPeople}</span>
                                            <span>작성일: {new Date(post.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteMatePost(post.id)} className="shrink-0 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white dark:bg-red-900/20 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors">
                                        <Trash2 size={14}/> 강제 삭제
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 탭 4: 보상 수동 지급 */}
                {!isLoading && activeTab === "REWARDS" && (
                    <div className="max-w-md mx-auto bg-white dark:bg-[#1a1a1a] p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400"><Gift size={32}/></div>
                            <h2 className="text-2xl font-black">유저 보상 지급</h2>
                            <p className="text-sm text-gray-500 mt-2">이벤트 당첨자나 오류 제보자에게<br/>수동으로 아이템을 지급합니다.</p>
                        </div>

                        <form onSubmit={handleGiveReward} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold mb-1.5 text-gray-700 dark:text-gray-300">지급 대상 유저 닉네임</label>
                                <input type="text" value={rewardForm.nickname} onChange={e => setRewardForm({...rewardForm, nickname: e.target.value})} placeholder="정확한 닉네임 입력" className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 text-sm outline-none focus:border-indigo-500"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1.5 text-gray-700 dark:text-gray-300">지급 아이템 종류</label>
                                <select value={rewardForm.itemType} onChange={e => setRewardForm({...rewardForm, itemType: e.target.value})} className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 text-sm outline-none focus:border-indigo-500">
                                    <option value="MEGAPHONE">📢 메이트 확성기 (개수)</option>
                                    <option value="POPPASS">👑 POP-PASS (일수 연장)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1.5 text-gray-700 dark:text-gray-300">수량 / 연장 일수</label>
                                <input type="number" min="1" max="365" value={rewardForm.amount} onChange={e => setRewardForm({...rewardForm, amount: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 text-sm outline-none focus:border-indigo-500"/>
                            </div>
                            <button type="submit" className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95">
                                즉시 지급하기
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}