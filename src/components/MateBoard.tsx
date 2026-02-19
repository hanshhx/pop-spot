"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Plus, User, MapPin, X, Megaphone, Crown } from "lucide-react"; // Megaphone 아이콘 추가
import { useChatStore } from "../store/useChatStore";
// 🔥 apiFetch import 확인 (경로 맞춰주세요)
import { apiFetch } from "../lib/api";

interface MateBoardProps {
  user: any; 
}

interface MatePost {
  id: number;
  title: string;
  content: string;
  status: string;
  targetPopup: string;
  maxPeople: number;
  currentPeople: number;
  author: {
    userId: string;
    nickname: string;
    isPremium: boolean;
  };
  createdAt: string;
  isMegaphone: boolean; // 🔥 [추가] 프론트에서도 이 필드를 받음
}

export default function MateBoard({ user }: MateBoardProps) {
  const [posts, setPosts] = useState<MatePost[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const openChat = useChatStore((state: any) => state.openChat);
  
  // 글쓰기 폼 상태
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetPopup: "",
    maxPeople: 2,
    useMegaphone: false // 🔥 [추가] 확성기 사용 여부
  });

  // 게시글 로딩 (정렬된 데이터가 옴)
  const fetchPosts = async () => {
    try {
      const res = await apiFetch("/api/mates");
      if (res.ok) setPosts(await res.json());
    } catch (e) {
      console.error("게시글 로딩 실패:", e);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSubmit = async () => {
    if (!user) return alert("로그인이 필요합니다.");
    if (!formData.title) return alert("제목을 입력해주세요.");

    const targetUserId = user.userId || user.id; 

    try {
      const res = await apiFetch("/api/mates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, userId: targetUserId })
      });
      
      if (res.ok) {
        alert(formData.useMegaphone ? "📢 확성기를 사용하여 상단에 등록되었습니다!" : "모집 글이 등록되었습니다!");
        setIsWriteOpen(false);
        fetchPosts(); 
        // 초기화
        setFormData({ title: "", content: "", targetPopup: "", maxPeople: 2, useMegaphone: false });
        
        // 내 확성기 개수 업데이트를 위해 새로고침 (혹은 전역 상태 갱신)
        if(formData.useMegaphone) window.location.reload();

      } else {
        const errorText = await res.text();
        alert(`등록 실패: ${errorText}`);
      }
    } catch (e) {
      alert("등록 실패");
    }
  };

  // 채팅 참여 로직
  const handleJoinChat = async (post: MatePost) => {
    if (!user) return alert("로그인이 필요합니다.");
    if (post.currentPeople >= post.maxPeople && post.author.nickname !== user.nickname) {
        return alert("모집 인원이 꽉 찼습니다.");
    }
    if (post.author.nickname === user.nickname) {
        openChat({ postId: post.id, postTitle: post.title, nickname: user.nickname, userId: user.userId || user.id, isAuthor: true });
        return;
    }
    try {
        const res = await apiFetch(`/api/mates/${post.id}/join`, { method: 'POST' });
        if (res.ok || (await res.text()).includes("이미 참여")) {
            openChat({ postId: post.id, postTitle: post.title, nickname: user.nickname, userId: user.userId || user.id, isAuthor: false });
            fetchPosts(); 
        } else {
            alert("입장 실패");
        }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-gray-50 dark:bg-black/50">
      
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-white/80 dark:bg-[#111]/80 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter">
            MATE<span className="text-indigo-500">.</span> BOARD
          </h2>
          <p className="text-xs text-gray-500 dark:text-white/60">혼자 가기 힘든 팝업, 동행을 구해보세요!</p>
        </div>
        <button 
          onClick={() => setIsWriteOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition-transform active:scale-95"
        >
          <Plus size={16}/> 글쓰기
        </button>
      </div>

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {posts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
                <p>아직 등록된 모집글이 없습니다.<br/>첫 번째 동행을 구해보세요!</p>
            </div>
        ) : (
            posts.map((post) => (
                <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-5 rounded-2xl border transition-all hover:shadow-lg bg-white dark:bg-[#1a1a1a] relative overflow-hidden
                        ${post.status === 'CLOSED' 
                            ? 'border-gray-200 dark:border-white/5 opacity-60' 
                            : post.isMegaphone // 🔥 확성기 글 강조 스타일 (핑크 네온)
                                ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.15)] dark:shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                                : 'border-indigo-100 dark:border-indigo-500/20 hover:border-indigo-500'
                        }`}
                >
                    {/* 🔥 확성기 뱃지 및 배경 효과 */}
                    {post.isMegaphone && (
                        <>
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-pink-500"></div>
                            <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl flex items-center gap-1 shadow-md">
                                <Megaphone size={12} fill="currentColor" className="animate-tada"/> AD
                            </div>
                        </>
                    )}

                    <div className="flex justify-between items-start mb-3 pl-3">
                        <div className="flex gap-2">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                post.status === 'RECRUITING' 
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                            }`}>
                                {post.status === 'RECRUITING' ? '모집중' : '모집완료'}
                            </span>
                            {post.targetPopup && (
                                <span className="px-2 py-1 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center gap-1">
                                    <MapPin size={10}/> {post.targetPopup}
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 pl-3 flex items-center gap-2">
                        {post.title}
                        {/* 제목 옆에도 아이콘 추가 */}
                        {post.isMegaphone && <Megaphone size={16} className="text-pink-500 animate-pulse"/>}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2 pl-3">{post.content}</p>

                    <div className="flex justify-between items-center border-t border-gray-100 dark:border-white/5 pt-4 pl-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-white dark:border-gray-600">
                                <User size={14} className="text-gray-500 dark:text-gray-400"/>
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                {post.author.nickname}
                                {post.author.isPremium && <Crown size={12} className="text-yellow-500 fill-yellow-500"/>}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                <span className="text-indigo-600 dark:text-indigo-400 text-sm mr-0.5">{post.currentPeople}</span>
                                / {post.maxPeople}명
                            </span>

                            {post.status === 'RECRUITING' ? (
                                <button 
                                    onClick={() => handleJoinChat(post)}
                                    className={`px-4 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md active:scale-95 ${
                                        post.isMegaphone ? "bg-pink-600 hover:bg-pink-500 shadow-pink-500/30" : "bg-indigo-600 hover:bg-indigo-500"
                                    }`}
                                >
                                    <MessageCircle size={14}/> 채팅 참여
                                </button>
                            ) : (
                                <button disabled className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-white dark:text-gray-400 rounded-xl text-xs font-bold cursor-not-allowed">
                                    모집 마감
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))
        )}
      </div>

      {/* 글쓰기 모달 */}
      <AnimatePresence>
        {isWriteOpen && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-sm bg-white dark:bg-[#222] rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-white/10"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">동행 모집하기</h3>
                        <button onClick={() => setIsWriteOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                            <X size={20}/>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <input 
                            type="text" placeholder="제목 (예: 이번주 토요일 탬버린즈 가실 분!)"
                            className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
                            value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                        />
                        <input 
                            type="text" placeholder="목표 팝업 (선택사항)"
                            className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
                            value={formData.targetPopup} onChange={e => setFormData({...formData, targetPopup: e.target.value})}
                        />
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl">
                            <span className="text-sm text-gray-500 dark:text-gray-400">모집 인원 (본인 포함)</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setFormData({...formData, maxPeople: Math.max(2, formData.maxPeople - 1)})} className="w-6 h-6 bg-gray-200 dark:bg-white/10 rounded-full flex items-center justify-center">-</button>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{formData.maxPeople}명</span>
                                <button onClick={() => setFormData({...formData, maxPeople: Math.min(10, formData.maxPeople + 1)})} className="w-6 h-6 bg-gray-200 dark:bg-white/10 rounded-full flex items-center justify-center">+</button>
                            </div>
                        </div>

                        <textarea 
                            placeholder="간단한 소개와 일정 등을 적어주세요."
                            className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-indigo-500 h-24 resize-none text-gray-900 dark:text-white"
                            value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
                        />
                        
                        {/* 🔥 확성기 사용 체크박스 */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            formData.useMegaphone 
                            ? "bg-pink-50 border-pink-500 dark:bg-pink-900/20" 
                            : "bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-white/10"
                        }`} onClick={() => {
                             if ((user.megaphoneCount || 0) > 0) {
                                 setFormData({...formData, useMegaphone: !formData.useMegaphone})
                             } else {
                                 if(confirm("확성기가 없습니다. 상점에서 구매하시겠습니까?")) window.location.href = "/shop";
                             }
                        }}>
                             <div className="flex items-center gap-2">
                                 <Megaphone size={18} className={formData.useMegaphone ? "text-pink-500" : "text-gray-400"} />
                                 <div className="flex flex-col">
                                     <span className={`text-sm font-bold ${formData.useMegaphone ? "text-pink-600 dark:text-pink-400" : "text-gray-500"}`}>확성기 사용하기</span>
                                     <span className="text-[10px] text-gray-400">내 보유량: {user.megaphoneCount || 0}개</span>
                                 </div>
                             </div>
                             <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.useMegaphone ? "bg-pink-500 border-pink-500" : "border-gray-300"}`}>
                                 {formData.useMegaphone && <div className="w-2 h-2 bg-white rounded-full"></div>}
                             </div>
                        </div>

                        <button 
                            onClick={handleSubmit}
                            className={`w-full py-3 text-white font-bold rounded-xl mt-2 transition-colors ${
                                formData.useMegaphone ? "bg-pink-600 hover:bg-pink-500 shadow-lg shadow-pink-500/30" : "bg-indigo-600 hover:bg-indigo-500"
                            }`}
                        >
                            {formData.useMegaphone ? "🔥 확성기로 등록하기" : "등록하기"}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}