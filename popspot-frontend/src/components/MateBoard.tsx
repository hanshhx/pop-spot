"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom"; 
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
  megaphone?: boolean; // 🔥 백엔드에서 날아오는 원본 키값 방어용
}

export default function MateBoard({ user }: MateBoardProps) {
  const [posts, setPosts] = useState<MatePost[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [mounted, setMounted] = useState(false); 
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
      if (res.ok) {
          const data = await res.json();
          // 🔥 [에러 해결 핵심] 
          // Spring Boot가 'isMegaphone'을 'megaphone'으로 바꿔서 보내는 현상 조치
          const normalizedData = data.map((p: any) => ({
              ...p,
              isMegaphone: p.isMegaphone === true || p.megaphone === true
          }));
          setPosts(normalizedData);
      }
    } catch (e) {
      console.error("게시글 로딩 실패:", e);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    setMounted(true);
    if (isWriteOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [isWriteOpen]);

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
    
    const targetUserId = user.userId || user.id;

    if (post.author.nickname === user.nickname) {
        openChat({ postId: post.id, postTitle: post.title, nickname: user.nickname, userId: targetUserId, isAuthor: true });
        return;
    }
    
    try {
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

  // 🔥 게시글을 확성기(모집중) 글과 일반 글로 분리합니다.
  const megaphonePosts = posts.filter(post => post.isMegaphone && post.status !== 'CLOSED');
  const normalPosts = posts.filter(post => !post.isMegaphone || post.status === 'CLOSED');

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

      {/* 전체 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-4">
        
        {/* 🔥 1. 확성기 전용 가로 스크롤 (HOT MATES) */}
        {megaphonePosts.length > 0 && (
          <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-white/5 py-5">
            <div className="px-4 md:px-6 mb-3 flex items-center gap-2">
              <Megaphone size={18} className="text-pink-500 animate-pulse md:w-5 md:h-5" fill="currentColor"/>
              <span className="font-black text-sm md:text-base text-gray-900 dark:text-white tracking-wide">HOT MATES</span>
            </div>
            
            {/* 가로 스와이프 컨테이너 */}
            <div className="flex overflow-x-auto gap-3 md:gap-4 px-4 md:px-6 pb-4 custom-scrollbar snap-x snap-mandatory">
              {megaphonePosts.map((post) => (
                <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    // 🔥 색상 완전 차별화: 핑크/로즈 그라데이션 및 특수 그림자
                    className="snap-start shrink-0 w-[280px] md:w-[320px] p-4 md:p-5 rounded-2xl border-2 border-pink-200 dark:border-pink-900/50 shadow-[0_4px_20px_rgba(236,72,153,0.15)] dark:shadow-[0_4px_20px_rgba(236,72,153,0.2)] bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/30 dark:to-[#1a1a1a] relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-pink-500"></div>
                    <div className="absolute top-0 right-0 bg-pink-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-bl-lg md:rounded-bl-xl flex items-center gap-1 shadow-md z-10">
                        <Megaphone size={10} className="md:w-3 md:h-3 animate-tada" fill="currentColor" /> AD
                    </div>
                    
                    <div className="flex justify-between items-start mb-3 pl-2 pr-10">
                        <div className="flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                모집중
                            </span>
                            {post.targetPopup && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 flex items-center gap-1 max-w-[120px] truncate">
                                    <MapPin size={8} className="shrink-0"/> <span className="truncate">{post.targetPopup}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white mb-1.5 pl-2 truncate pr-2">
                        {post.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-1 pl-2 pr-2">{post.content}</p>
                    
                    <div className="flex justify-between items-center mt-auto pl-2 border-t border-pink-100 dark:border-pink-900/30 pt-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center border border-pink-200 dark:border-pink-800">
                                <User size={12} className="md:w-4 md:h-4 text-pink-500"/>
                            </div>
                            <span className="text-[10px] md:text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[80px] flex items-center gap-1">
                              <span className="truncate">{post.author.nickname}</span>
                              {post.author.isPremium && <Crown size={10} className="text-yellow-500 fill-yellow-500 shrink-0"/>}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400">
                                <span className="text-pink-600 dark:text-pink-400 text-xs md:text-sm mr-0.5">{post.currentPeople}</span>/{post.maxPeople}명
                            </span>
                            <button onClick={() => handleJoinChat(post)} className="px-3 py-1.5 md:px-4 md:py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold shadow-md shadow-pink-500/30 flex items-center gap-1 transition-all active:scale-95">
                                <MessageCircle size={12} className="md:w-3.5 md:h-3.5"/> 참여
                            </button>
                        </div>
                    </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 🔥 2. 일반 게시글 세로 스크롤 영역 */}
        <div className="p-3 md:p-4 space-y-3 md:space-y-4">
          {normalPosts.length === 0 && megaphonePosts.length === 0 ? (
              <div className="text-center py-16 md:py-20 text-gray-400 text-xs md:text-sm">
                  <p>아직 등록된 모집글이 없습니다.<br/>첫 번째 동행을 구해보세요!</p>
              </div>
          ) : (
              normalPosts.map((post) => (
                  <motion.div 
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all hover:shadow-lg bg-white dark:bg-[#1a1a1a] relative overflow-hidden
                          ${post.status === 'CLOSED' 
                              ? 'border-gray-200 dark:border-white/5 opacity-60' 
                              : 'border-indigo-100 dark:border-indigo-500/20 hover:border-indigo-500'
                          }`}
                  >
                      {/* 기간 만료/마감된 확성기 글 처리용 */}
                      {post.isMegaphone && post.status === 'CLOSED' && (
                          <div className="absolute top-0 right-0 bg-gray-400 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-bl-lg md:rounded-bl-xl flex items-center gap-1">
                              마감된 광고
                          </div>
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
                              <button 
                                  onClick={() => handleJoinChat(post)}
                                  className={`px-3 py-1.5 md:px-4 md:py-2 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1 transition-all active:scale-95 ${
                                      post.status === 'CLOSED' ? "bg-gray-500 hover:bg-gray-600" : "bg-indigo-600 hover:bg-indigo-500"
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
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {isWriteOpen && (
              <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div 
                      initial={{ scale: 0.95, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 20 }}
                      className="w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#1f1f1f] rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-2xl border border-gray-200 dark:border-white/10"
                  >
                      <div className="flex justify-between items-center mb-4 md:mb-6">
                          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">동행 모집하기</h3>
                          <button onClick={() => setIsWriteOpen(false)} className="p-1.5 md:p-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors text-gray-700 dark:text-white/70">
                              <X size={18} className="md:w-5 md:h-5"/>
                          </button>
                      </div>

                      <div className="space-y-3 md:space-y-4">
                          <input 
                              type="text" placeholder="제목 (예: 이번주 토요일 탬버린즈 가실 분!)"
                              className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
                              value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                          />
                          <input 
                              type="text" placeholder="목표 팝업 (선택사항)"
                              className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
                              value={formData.targetPopup} onChange={e => setFormData({...formData, targetPopup: e.target.value})}
                          />
                          
                          <div className="flex items-center justify-between p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl">
                              <span className="text-xs md:text-sm font-bold text-gray-600 dark:text-gray-300">모집 인원 (본인 포함)</span>
                              <div className="flex items-center gap-2 md:gap-3">
                                  <button onClick={() => setFormData({...formData, maxPeople: Math.max(2, formData.maxPeople - 1)})} className="w-6 h-6 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-full flex items-center justify-center text-sm transition-colors text-gray-700 dark:text-white">-</button>
                                  <span className="font-black text-sm md:text-base text-indigo-600 dark:text-indigo-400 w-8 text-center">{formData.maxPeople}명</span>
                                  <button onClick={() => setFormData({...formData, maxPeople: Math.min(10, formData.maxPeople + 1)})} className="w-6 h-6 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-full flex items-center justify-center text-sm transition-colors text-gray-700 dark:text-white">+</button>
                              </div>
                          </div>

                          <textarea 
                              placeholder="간단한 소개와 일정 등을 적어주세요."
                              className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-indigo-500 h-24 md:h-28 resize-none text-gray-900 dark:text-white custom-scrollbar"
                              value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
                          />
                          
                          <div className={`p-3 md:p-4 rounded-lg md:rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                              formData.useMegaphone 
                              ? "bg-pink-50 border-pink-500 dark:bg-pink-900/20 dark:border-pink-500/50" 
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
                          }`} onClick={() => {
                               if ((user.megaphoneCount || 0) > 0) {
                                   setFormData({...formData, useMegaphone: !formData.useMegaphone})
                               } else {
                                   if(confirm("확성기가 없습니다. 상점에서 구매하시겠습니까?")) window.location.href = "/shop";
                               }
                          }}>
                               <div className="flex items-center gap-2 md:gap-3">
                                   <div className={`p-1.5 md:p-2 rounded-full ${formData.useMegaphone ? 'bg-pink-100 dark:bg-pink-500/20' : 'bg-gray-200 dark:bg-white/10'}`}>
                                      <Megaphone size={16} className={`md:w-[18px] md:h-[18px] ${formData.useMegaphone ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                                   </div>
                                   <div className="flex flex-col">
                                       <span className={`text-xs md:text-sm font-black ${formData.useMegaphone ? "text-pink-600 dark:text-pink-400" : "text-gray-700 dark:text-gray-300"}`}>확성기 사용하기</span>
                                       <span className="text-[10px] md:text-xs text-gray-500 mt-0.5 font-medium">내 보유량: <strong className="text-indigo-500">{user.megaphoneCount || 0}</strong>개</span>
                                   </div>
                               </div>
                               <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-colors ${formData.useMegaphone ? "bg-pink-500 border-pink-500" : "border-gray-300 dark:border-gray-600"}`}>
                                   {formData.useMegaphone && <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>}
                               </div>
                          </div>

                          <button 
                              onClick={handleSubmit}
                              className={`w-full py-3.5 md:py-4 text-white font-black rounded-lg md:rounded-xl mt-4 transition-all active:scale-95 text-sm md:text-base ${
                                  formData.useMegaphone 
                                  ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/30" 
                                  : "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                              }`}
                          >
                              {formData.useMegaphone ? "🔥 확성기로 등록하기" : "동행 모집글 등록하기"}
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}