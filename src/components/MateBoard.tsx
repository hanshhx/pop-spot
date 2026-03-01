"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Plus, User, MapPin, X, Megaphone, Crown } from "lucide-react"; 
import { useChatStore } from "../store/useChatStore";
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
  isMegaphone: boolean;
}

export default function MateBoard({ user }: MateBoardProps) {
  const [posts, setPosts] = useState<MatePost[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const openChat = useChatStore((state: any) => state.openChat);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetPopup: "",
    maxPeople: 2,
    useMegaphone: false
  });

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
        setFormData({ title: "", content: "", targetPopup: "", maxPeople: 2, useMegaphone: false });
        if(formData.useMegaphone) window.location.reload();
      } else {
        const errorText = await res.text();
        alert(`등록 실패: ${errorText}`);
      }
    } catch (e) {
      alert("등록 실패");
    }
  };

  const handleJoinChat = async (post: MatePost) => {
    if (!user) return alert("로그인이 필요합니다.");
    
    // API 통신을 위한 유저 ID 확보
    const targetUserId = user.userId || user.id;

    if (post.author.nickname === user.nickname) {
        openChat({ postId: post.id, postTitle: post.title, nickname: user.nickname, userId: targetUserId, isAuthor: true });
        return;
    }
    
    try {
        // 🔥 [수정] 백엔드가 "누구인지" 알 수 있게 ?userId= 를 붙여서 보냅니다.
        const res = await apiFetch(`/api/mates/${post.id}/join?userId=${targetUserId}`, { method: 'POST' });
        const msg = await res.text();

        if (res.ok || msg.includes("이미 참여")) {
            openChat({ postId: post.id, postTitle: post.title, nickname: user.nickname, userId: targetUserId, isAuthor: false });
            fetchPosts(); 
        } else {
            alert(msg === "FULL" ? "모집 인원이 꽉 찼습니다." : msg);
        }
    } catch (e) { 
        console.error(e); 
        alert("서버 통신 오류가 발생했습니다.");
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-gray-50 dark:bg-black/50">
      
      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-white/80 dark:bg-[#111]/80 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter">
            MATE<span className="text-indigo-500">.</span> BOARD
          </h2>
          <p className="text-[10px] md:text-xs text-gray-500 dark:text-white/60 mt-0.5">혼자 가기 힘든 팝업, 동행을 구해보세요!</p>
        </div>
        <button 
          onClick={() => setIsWriteOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-lg flex items-center gap-1.5 md:gap-2 transition-transform active:scale-95"
        >
          <Plus size={14} className="md:w-4 md:h-4"/> 글쓰기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 custom-scrollbar pb-20 md:pb-4">
        {posts.length === 0 ? (
            <div className="text-center py-16 md:py-20 text-gray-400 text-xs md:text-sm">
                <p>아직 등록된 모집글이 없습니다.<br/>첫 번째 동행을 구해보세요!</p>
            </div>
        ) : (
            posts.map((post) => (
                <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all hover:shadow-lg bg-white dark:bg-[#1a1a1a] relative overflow-hidden
                        ${post.status === 'CLOSED' 
                            ? 'border-gray-200 dark:border-white/5 opacity-60' 
                            : post.isMegaphone 
                                ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.15)] dark:shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                                : 'border-indigo-100 dark:border-indigo-500/20 hover:border-indigo-500'
                        }`}
                >
                    {post.isMegaphone && (
                        <>
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-pink-500"></div>
                            <div className="absolute top-0 right-0 bg-pink-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-bl-lg md:rounded-bl-xl flex items-center gap-1 shadow-md">
                                <Megaphone size={10} className="md:w-3 md:h-3 animate-tada" fill="currentColor" /> AD
                            </div>
                        </>
                    )}

                    <div className="flex justify-between items-start mb-2 md:mb-3 pl-2.5 md:pl-3">
                        <div className="flex flex-wrap gap-1.5 md:gap-2 pr-10">
                            <span className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold shrink-0 ${
                                post.status === 'RECRUITING' 
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                            }`}>
                                {post.status === 'RECRUITING' ? '모집중' : '모집완료'}
                            </span>
                            {post.targetPopup && (
                                <span className="px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center gap-1 truncate max-w-[150px] md:max-w-[200px]">
                                    <MapPin size={8} className="md:w-2.5 md:h-2.5 shrink-0"/> <span className="truncate">{post.targetPopup}</span>
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] md:text-xs text-gray-400 shrink-0">{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>

                    <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-1.5 md:mb-2 pl-2.5 md:pl-3 flex items-center gap-1.5 md:gap-2 pr-2">
                        <span className="truncate">{post.title}</span>
                        {post.isMegaphone && <Megaphone size={14} className="text-pink-500 animate-pulse shrink-0 md:w-4 md:h-4"/>}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-3 md:mb-4 line-clamp-2 pl-2.5 md:pl-3">{post.content}</p>

                    <div className="flex justify-between items-center border-t border-gray-100 dark:border-white/5 pt-3 md:pt-4 pl-2.5 md:pl-3">
                        <div className="flex items-center gap-1.5 md:gap-2 overflow-hidden pr-2">
                            <div className="w-6 h-6 md:w-8 md:h-8 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-white dark:border-gray-600">
                                <User size={12} className="md:w-3.5 md:h-3.5 text-gray-500 dark:text-gray-400"/>
                            </div>
                            <span className="text-[10px] md:text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 truncate">
                                <span className="truncate">{post.author.nickname}</span>
                                {post.author.isPremium && <Crown size={10} className="md:w-3 md:h-3 text-yellow-500 fill-yellow-500 shrink-0"/>}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3 shrink-0">
                            <span className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400">
                                <span className="text-indigo-600 dark:text-indigo-400 text-xs md:text-sm mr-0.5">{post.currentPeople}</span>
                                / {post.maxPeople}명
                            </span>

                            {/* 🔥 버튼 로직: 꽉 찼더라도 일단 버튼은 활성화해서 누르면 서버가 판단하게 함 */}
                            <button 
                                onClick={() => handleJoinChat(post)}
                                className={`px-3 py-1.5 md:px-4 md:py-2 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1 transition-all shadow-md active:scale-95 ${
                                    post.status === 'CLOSED' ? "bg-gray-500 hover:bg-gray-600" : (post.isMegaphone ? "bg-pink-600 hover:bg-pink-500 shadow-pink-500/30" : "bg-indigo-600 hover:bg-indigo-500")
                                }`}
                            >
                                <MessageCircle size={12} className="md:w-3.5 md:h-3.5"/> 채팅 참여
                            </button>
                        </div>
                    </div>
                </motion.div>
            ))
        )}
      </div>

      <AnimatePresence>
        {isWriteOpen && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-sm bg-white dark:bg-[#222] rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-2xl border border-gray-200 dark:border-white/10"
                >
                    <div className="flex justify-between items-center mb-4 md:mb-6">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">동행 모집하기</h3>
                        <button onClick={() => setIsWriteOpen(false)} className="p-1.5 md:p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                            <X size={18} className="md:w-5 md:h-5"/>
                        </button>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                        <input 
                            type="text" placeholder="제목 (예: 이번주 토요일 탬버린즈 가실 분!)"
                            className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
                            value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                        />
                        <input 
                            type="text" placeholder="목표 팝업 (선택사항)"
                            className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
                            value={formData.targetPopup} onChange={e => setFormData({...formData, targetPopup: e.target.value})}
                        />
                        
                        <div className="flex items-center justify-between p-2.5 md:p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl">
                            <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">모집 인원 (본인 포함)</span>
                            <div className="flex items-center gap-2 md:gap-3">
                                <button onClick={() => setFormData({...formData, maxPeople: Math.max(2, formData.maxPeople - 1)})} className="w-5 h-5 md:w-6 md:h-6 bg-gray-200 dark:bg-white/10 rounded-full flex items-center justify-center text-xs md:text-sm">-</button>
                                <span className="font-bold text-sm md:text-base text-indigo-600 dark:text-indigo-400 w-8 text-center">{formData.maxPeople}명</span>
                                <button onClick={() => setFormData({...formData, maxPeople: Math.min(10, formData.maxPeople + 1)})} className="w-5 h-5 md:w-6 md:h-6 bg-gray-200 dark:bg-white/10 rounded-full flex items-center justify-center text-xs md:text-sm">+</button>
                            </div>
                        </div>

                        <textarea 
                            placeholder="간단한 소개와 일정 등을 적어주세요."
                            className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-indigo-500 h-20 md:h-24 resize-none text-gray-900 dark:text-white"
                            value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
                        />
                        
                        <div className={`p-2.5 md:p-3 rounded-lg md:rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
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
                             <div className="flex items-center gap-1.5 md:gap-2">
                                 <Megaphone size={16} className={`md:w-[18px] md:h-[18px] ${formData.useMegaphone ? "text-pink-500" : "text-gray-400"}`} />
                                 <div className="flex flex-col">
                                     <span className={`text-xs md:text-sm font-bold ${formData.useMegaphone ? "text-pink-600 dark:text-pink-400" : "text-gray-500"}`}>확성기 사용하기</span>
                                     <span className="text-[9px] md:text-[10px] text-gray-400 mt-0.5">내 보유량: {user.megaphoneCount || 0}개</span>
                                 </div>
                             </div>
                             <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center ${formData.useMegaphone ? "bg-pink-500 border-pink-500" : "border-gray-300"}`}>
                                 {formData.useMegaphone && <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full"></div>}
                             </div>
                        </div>

                        <button 
                            onClick={handleSubmit}
                            className={`w-full py-2.5 md:py-3 text-white font-bold rounded-lg md:rounded-xl mt-2 transition-colors text-sm md:text-base ${
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