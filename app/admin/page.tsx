"use client";

import { useEffect, useState } from "react";
import { Check, X, ShieldCheck, MapPin, Calendar } from "lucide-react";

export default function AdminDashboard() {
  const [pendingPopups, setPendingPopups] = useState<any[]>([]);

  // 1. 대기 중인 팝업 불러오기 (새로운 IP 적용)
  const fetchPending = async () => {
    try {
      const res = await fetch("http://34.121.40.248:8080/api/admin/popups/pending");
      if (res.ok) {
        setPendingPopups(await res.json());
      }
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  // 2. 승인 처리 (새로운 IP 적용)
  const handleApprove = async (id: number) => {
    if (!confirm("이 팝업을 승인하시겠습니까?\n(제보자에게 확성기가 지급되며 지도에 즉시 노출됩니다.)")) return;
    
    try {
      await fetch(`http://34.121.40.248:8080/api/admin/popups/${id}/approve`, { method: "POST" });
      alert("승인 완료! 맵에 노출됩니다.");
      fetchPending(); // 목록 새로고침
    } catch (error) {
      alert("승인 처리 중 오류가 발생했습니다.");
    }
  };

  // 3. 거절(삭제) 처리 (새로운 IP 적용)
  const handleReject = async (id: number) => {
    if (!confirm("이 제보를 거절하고 삭제하시겠습니까?")) return;
    
    try {
      await fetch(`http://34.121.40.248:8080/api/admin/popups/${id}/reject`, { method: "DELETE" });
      alert("거절(삭제) 완료!");
      fetchPending(); // 목록 새로고침
    } catch (error) {
      alert("거절 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212] p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={40} />
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">ADMIN DASHBOARD</h1>
            <p className="text-sm text-gray-500">팝업스토어 제보 승인 대기열</p>
          </div>
        </div>

        {/* 리스트 영역 */}
        <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden">
          {pendingPopups.length === 0 ? (
            <div className="p-20 text-center text-gray-400 font-medium">
              현재 대기 중인 제보가 없습니다. ✨
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {pendingPopups.map((popup) => (
                <li key={popup.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  
                  {/* 정보 영역 */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded">대기중</span>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{popup.name}</h3>
                      <span className="text-xs text-indigo-500 font-medium">{popup.category}</span>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400"/> {popup.location} ({popup.address})
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400"/> {popup.startDate} ~ {popup.endDate}
                    </div>
                    
                    <div className="text-xs text-gray-400 mt-2 bg-gray-100 dark:bg-black/30 inline-block px-3 py-1.5 rounded-lg">
                      🗣️ 제보자 ID: <span className="font-mono text-gray-600 dark:text-gray-300">{popup.reporterId}</span>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleApprove(popup.id)}
                      className="flex items-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-transform active:scale-95"
                    >
                      <Check size={18} /> 승인하기
                    </button>
                    <button 
                      onClick={() => handleReject(popup.id)}
                      className="flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-transform active:scale-95"
                    >
                      <X size={18} /> 거절(삭제)
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}