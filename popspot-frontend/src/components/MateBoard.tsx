"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Plus, User as UserIcon, MapPin, X, TrendingUp, Crown, Flag } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { apiFetch } from "../lib/api";
import { notify, notifyError } from "@/lib/notify";
import { BOOST_LIMIT_HINT, type BoostStatus } from "@/lib/boost";
import type { RankKey } from "@/lib/rank";
import type { User as DomainUser } from "@/types/popup";

interface MateBoardProps {
  user: DomainUser;
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
    /** v2.16 — 작성자 프로필 사진. 백엔드 MatePost.author = User 이고 picture 컬럼 그대로. */
    picture?: string | null;
  };
  createdAt: string;
  isMegaphone: boolean;
  megaphone?: boolean;
}

export default function MateBoard({ user }: MateBoardProps) {
  const [posts, setPosts] = useState<MatePost[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [boostStatus, setBoostStatus] = useState<BoostStatus | null>(null);
  const openChat = useChatStore((state) => state.openChat);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetPopup: "",
    maxPeople: 2,
    useBoost: false,
  });

  const fetchPosts = async () => {
    try {
      const res = await apiFetch("/api/mates");
      if (res.ok) {
          const data = await res.json();
          // Spring Boot 가 boolean 게터를 직렬화하면서 `isMegaphone` → `megaphone` 으로 키가
          // 바뀌어 들어오는 케이스를 양쪽 다 받아 정규화.
          const normalizedData = (data as MatePost[]).map((p) => ({
              ...p,
              isMegaphone: p.isMegaphone === true || p.megaphone === true,
          }));
          setPosts(normalizedData);
      }
    } catch (e) {
      console.error("게시글 로딩 실패:", e);
    }
  };

  const fetchBoostStatus = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/mates/boost-status?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = (await res.json()) as BoostStatus;
        setBoostStatus(data);
      }
    } catch {
      // 잔여 횟수 표시 실패는 글쓰기 자체를 막지 않음 — 그냥 잔여 정보 미표시.
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    setMounted(true);
    if (isWriteOpen) {
      document.body.style.overflow = "hidden";
      const targetUserId = user.userId || user.id || "";
      if (targetUserId) fetchBoostStatus(targetUserId);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWriteOpen]);

  const handleSubmit = async () => {
    if (!user) return notify("로그인이 필요합니다.");
    if (!formData.title) return notify("제목을 입력해주세요.");

    const targetUserId = user.userId || user.id || "";
    if (!targetUserId) return notify("사용자 정보를 확인할 수 없습니다.");

    try {
      const res = await apiFetch("/api/mates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, userId: targetUserId }),
      });

      if (res.ok) {
        notify(
          formData.useBoost
            ? "상단 부스트가 적용된 모집글이 등록되었습니다."
            : "모집 글이 등록되었습니다.",
        );
        setIsWriteOpen(false);
        fetchPosts();
        setFormData({ title: "", content: "", targetPopup: "", maxPeople: 2, useBoost: false });
        if (formData.useBoost) fetchBoostStatus(targetUserId);
      } else {
        const errorText = await res.text();
        notifyError(`등록 실패: ${errorText}`);
      }
    } catch {
      notifyError("등록 실패");
    }
  };

  /**
   * v2.18.1 — 게시글 신고. 본인 글이면 차단. 누적 신고 도달 시 백엔드가 자동 isHidden.
   */
  const handleReport = async (post: MatePost) => {
    if (!user) return notify("로그인이 필요합니다.");
    const targetUserId = user.userId || user.id || "";
    if (post.author.userId === targetUserId || post.author.nickname === user.nickname) {
      return notify("본인 글은 신고할 수 없습니다.");
    }
    const { confirmAction } = await import("@/lib/notify");
    const ok = await confirmAction({
      title: "이 글을 신고할까요?",
      text: "스팸 / 욕설 / 부적절한 내용 등을 신고하면 운영자가 검토합니다.",
      icon: "warning",
      destructive: true,
      confirmText: "신고",
    });
    if (!ok) return;

    try {
      const res = await apiFetch(
        `/api/mates/${post.id}/report?userId=${encodeURIComponent(targetUserId)}`,
        { method: "POST" },
      );
      if (res.ok) {
        notify("신고가 접수되었습니다.");
        fetchPosts();
      } else {
        const msg = await res.text();
        notifyError(msg || "신고 처리에 실패했습니다.");
      }
    } catch {
      notifyError("서버 통신 오류가 발생했습니다.");
    }
  };

  const handleJoinChat = async (post: MatePost) => {
    if (!user) return notify("로그인이 필요합니다.");

    const targetUserId = user.userId || user.id || "";
    if (!targetUserId) return notify("사용자 정보를 확인할 수 없습니다.");

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
            notify(msg === "FULL" ? "모집 인원이 꽉 찼습니다." : msg);
        }
    } catch (e) { 
        console.error(e); 
        notifyError("서버 통신 오류가 발생했습니다.");
    }
  };

  const megaphonePosts = posts.filter(post => post.isMegaphone && post.status !== 'CLOSED');
  const normalPosts = posts.filter(post => !post.isMegaphone || post.status === 'CLOSED');

  return (
    <div className="w-full h-full flex flex-col relative bg-gray-50 dark:bg-black/50">
      
      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-white/80 dark:bg-ink-700/80 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter">
            MATE<span className="text-lime-500">.</span> BOARD
          </h2>
          <p className="text-[10px] md:text-xs text-gray-500 dark:text-cream-200/60 mt-0.5">혼자 가기 힘든 팝업, 동행을 구해보세요!</p>
        </div>
        <button 
          onClick={() => setIsWriteOpen(true)}
          className="bg-lime-300 hover:bg-lime-400 text-ink-900 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-lg flex items-center gap-1.5 md:gap-2 transition-transform active:scale-95"
        >
          <Plus size={14} className="md:w-4 md:h-4"/> 글쓰기
        </button>
      </div>

      {/* 전체 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-4">
        
        
        {megaphonePosts.length > 0 && (
          <div className="bg-lime-300/5 dark:bg-ink-800/50 border-b border-[var(--color-border)] dark:border-white/5 py-5">
            <div className="px-4 md:px-6 mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-hot-400 md:w-5 md:h-5" />
              <span className="font-black text-sm md:text-base text-gray-900 dark:text-white tracking-wide">상단 부스트</span>
            </div>
            
            {/* 가로 스와이프 컨테이너 */}
            <div className="flex overflow-x-auto gap-3 md:gap-4 px-4 md:px-6 pb-4 custom-scrollbar snap-x snap-mandatory">
              {megaphonePosts.map((post) => (
                <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="snap-start shrink-0 w-[280px] md:w-[320px] p-4 md:p-5 rounded-2xl border-2 border-hot-200 dark:border-hot-900/50 shadow-[0_4px_20px_rgba(236,72,153,0.15)] dark:shadow-[0_4px_20px_rgba(236,72,153,0.2)] bg-gradient-to-br from-hot-50 to-white dark:from-hot-900/30 dark:to-[#1a1a1a] relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-hot-400"></div>
                    <div className="absolute top-0 right-0 bg-hot-400 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-bl-lg md:rounded-bl-xl flex items-center gap-1 shadow-md z-10">
                        <TrendingUp size={10} className="md:w-3 md:h-3" /> 부스트
                    </div>
                    
                    <div className="flex justify-between items-start mb-3 pl-2 pr-10">
                        <div className="flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                모집중
                            </span>
                            {post.targetPopup && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold bg-hot-100 text-hot-500 dark:bg-hot-900/30 dark:text-hot-400 flex items-center gap-1 max-w-[120px] truncate">
                                    <MapPin size={8} className="shrink-0"/> <span className="truncate">{post.targetPopup}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white mb-1.5 pl-2 truncate pr-2">
                        {post.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-1 pl-2 pr-2">{post.content}</p>
                    
                    <div className="flex justify-between items-center mt-auto pl-2 border-t border-hot-100 dark:border-hot-900/30 pt-3">
                        <div className="flex items-center gap-1.5">
                            <AuthorAvatar
                                picture={post.author.picture}
                                fallbackBg="bg-hot-100 dark:bg-hot-900/50"
                                fallbackIconColor="text-hot-400"
                                size="md"
                            />
                            <span className="text-[10px] md:text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[80px] flex items-center gap-1">
                              <span className="truncate">{post.author.nickname}</span>
                              {post.author.isPremium && <Crown size={10} className="text-yellow-500 fill-yellow-500 shrink-0"/>}
                              {isMyPost(post, user) && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-black bg-lime-300 text-ink-900">내 글</span>
                              )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400">
                                <span className="text-hot-500 dark:text-hot-400 text-xs md:text-sm mr-0.5">{post.currentPeople}</span>/{post.maxPeople}명
                            </span>
                            <button onClick={() => handleJoinChat(post)} className="px-3 py-1.5 md:px-4 md:py-2 bg-hot-500 hover:bg-hot-400 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold shadow-md shadow-hot-400/30 flex items-center gap-1 transition-all active:scale-95">
                                <MessageCircle size={12} className="md:w-3.5 md:h-3.5"/> 참여
                            </button>
                        </div>
                    </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

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
                      className={`p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all hover:shadow-lg bg-white dark:bg-ink-700 relative overflow-hidden
                          ${post.status === 'CLOSED' 
                              ? 'border-gray-200 dark:border-white/5 opacity-60' 
                              : 'border-[var(--color-border)] dark:border-lime-300/20 hover:border-lime-300'
                          }`}
                  >
                      {/* 마감된 부스트 글 처리용 */}
                      {post.isMegaphone && post.status === 'CLOSED' && (
                          <div className="absolute top-0 right-0 bg-gray-400 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-bl-lg md:rounded-bl-xl flex items-center gap-1">
                              마감된 부스트
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
                                  <span className="px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold bg-lime-300/10 text-lime-500 dark:bg-ink-800 dark:text-lime-300 flex items-center gap-1 truncate max-w-[150px] md:max-w-[200px]">
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
                              <AuthorAvatar
                                  picture={post.author.picture}
                                  fallbackBg="bg-gray-200 dark:bg-gray-700"
                                  fallbackIconColor="text-gray-500 dark:text-gray-400"
                                  size="md"
                              />
                              <span className="text-[10px] md:text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 truncate">
                                  <span className="truncate">{post.author.nickname}</span>
                                  {post.author.isPremium && <Crown size={10} className="md:w-3 md:h-3 text-yellow-500 fill-yellow-500 shrink-0"/>}
                                  {isMyPost(post, user) && (
                                      <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-black bg-lime-300 text-ink-900">내 글</span>
                                  )}
                              </span>
                          </div>

                          <div className="flex items-center gap-2 md:gap-3 shrink-0">
                              <span className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400">
                                  <span className="text-lime-500 text-xs md:text-sm mr-0.5">{post.currentPeople}</span>
                                  / {post.maxPeople}명
                              </span>
                              {/* v2.18.1 — 본인 글이 아니면 신고 버튼 노출 */}
                              {!isMyPost(post, user) && (
                                  <button
                                      type="button"
                                      onClick={() => handleReport(post)}
                                      aria-label="이 글 신고"
                                      title="신고"
                                      className="p-1.5 text-gray-400 hover:text-danger transition-colors rounded-pill hover:bg-danger/10"
                                  >
                                      <Flag size={12} className="md:w-3.5 md:h-3.5" />
                                  </button>
                              )}
                              <button
                                  onClick={() => handleJoinChat(post)}
                                  className={`px-3 py-1.5 md:px-4 md:py-2 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1 transition-all active:scale-95 ${
                                      post.status === 'CLOSED' ? "bg-gray-500 hover:bg-gray-600" : "bg-lime-300 hover:bg-lime-400 text-ink-900"
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
                          <button onClick={() => setIsWriteOpen(false)} className="p-1.5 md:p-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors text-gray-700 dark:text-cream-200/70">
                              <X size={18} className="md:w-5 md:h-5"/>
                          </button>
                      </div>

                      <div className="space-y-3 md:space-y-4">
                          <input 
                              type="text" placeholder="제목 (예: 이번주 토요일 탬버린즈 가실 분!)"
                              className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-lime-300 text-gray-900 dark:text-white"
                              value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                          />
                          <input 
                              type="text" placeholder="목표 팝업 (선택사항)"
                              className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-lime-300 text-gray-900 dark:text-white"
                              value={formData.targetPopup} onChange={e => setFormData({...formData, targetPopup: e.target.value})}
                          />
                          
                          <div className="flex items-center justify-between p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl">
                              <span className="text-xs md:text-sm font-bold text-gray-600 dark:text-gray-300">모집 인원 (본인 포함)</span>
                              <div className="flex items-center gap-2 md:gap-3">
                                  <button onClick={() => setFormData({...formData, maxPeople: Math.max(2, formData.maxPeople - 1)})} className="w-6 h-6 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-full flex items-center justify-center text-sm transition-colors text-gray-700 dark:text-white">-</button>
                                  <span className="font-black text-sm md:text-base text-lime-500 w-8 text-center">{formData.maxPeople}명</span>
                                  <button onClick={() => setFormData({...formData, maxPeople: Math.min(10, formData.maxPeople + 1)})} className="w-6 h-6 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-full flex items-center justify-center text-sm transition-colors text-gray-700 dark:text-white">+</button>
                              </div>
                          </div>

                          <textarea 
                              placeholder="간단한 소개와 일정 등을 적어주세요."
                              className="w-full p-2.5 md:p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg md:rounded-xl text-xs md:text-sm outline-none focus:border-lime-300 h-24 md:h-28 resize-none text-gray-900 dark:text-white custom-scrollbar"
                              value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
                          />
                          
                          <BoostToggle
                              boostStatus={boostStatus}
                              active={formData.useBoost}
                              onToggle={(next) => {
                                  if (next && (!boostStatus || boostStatus.remaining <= 0)) {
                                      notify(
                                          boostStatus && boostStatus.rank === "NONE"
                                              ? "입문자 등급(스탬프 3개)에 도달해야 부스트를 사용할 수 있습니다."
                                              : "이번 달 부스트 횟수를 모두 사용했습니다.",
                                      );
                                      return;
                                  }
                                  setFormData({ ...formData, useBoost: next });
                              }}
                          />

                          <button
                              onClick={handleSubmit}
                              className={`w-full py-3.5 md:py-4 text-white font-black rounded-lg md:rounded-xl mt-4 transition-all active:scale-95 text-sm md:text-base ${
                                  formData.useBoost
                                  ? "bg-gradient-to-r from-hot-400 to-rose-500 hover:from-hot-500 hover:to-rose-600 shadow-lg shadow-hot-400/30"
                                  : "bg-lime-300 hover:bg-lime-400 text-ink-900 shadow-md"
                              }`}
                          >
                              {formData.useBoost ? "상단 부스트로 등록하기" : "동행 모집글 등록하기"}
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

/**
 * v2.16 — 동행 게시판 작성자 프로필 사진. 사진 없으면 lucide UserIcon fallback.
 * 외부 OAuth 도메인 + 자체 uploads 경로 모두 지원 (unoptimized).
 */
function AuthorAvatar({
  picture,
  fallbackBg,
  fallbackIconColor,
  size,
}: {
  picture?: string | null;
  fallbackBg: string;
  fallbackIconColor: string;
  size: "sm" | "md";
}) {
  const sizeClass = size === "sm"
    ? "w-5 h-5 md:w-6 md:h-6"
    : "w-6 h-6 md:w-8 md:h-8";
  if (picture) {
    return (
      <Image
        src={picture}
        alt=""
        width={32}
        height={32}
        className={`${sizeClass} shrink-0 rounded-full object-cover border border-white dark:border-gray-600`}
        unoptimized
      />
    );
  }
  return (
    <div
      className={`${sizeClass} shrink-0 rounded-full ${fallbackBg} flex items-center justify-center border border-white dark:border-gray-600`}
    >
      <UserIcon size={12} className={`md:w-3.5 md:h-3.5 ${fallbackIconColor}`} />
    </div>
  );
}

/** v2.16 — 본인이 작성한 글인지 판정. userId 우선, fallback 으로 nickname 비교. */
function isMyPost(post: MatePost, viewer: DomainUser): boolean {
  const viewerId = viewer.userId || viewer.id || "";
  if (post.author.userId && viewerId && post.author.userId === viewerId) {
    return true;
  }
  return post.author.nickname === viewer.nickname;
}

interface BoostToggleProps {
  boostStatus: BoostStatus | null;
  active: boolean;
  onToggle: (next: boolean) => void;
}

/** 글쓰기 모달의 상단 부스트 토글. 잔여 횟수가 0 이면 disabled 처럼 동작. */
function BoostToggle({ boostStatus, active, onToggle }: BoostToggleProps) {
  const rank: RankKey = boostStatus?.rank ?? "NONE";
  const remaining = boostStatus?.remaining ?? 0;
  const limit = boostStatus?.monthlyLimit ?? 0;
  const available = remaining > 0;

  return (
    <div
      className={`p-3 md:p-4 rounded-lg md:rounded-xl border flex items-center justify-between transition-colors ${
        active
          ? "bg-hot-50 border-hot-400 dark:bg-hot-900/20 dark:border-hot-400/50"
          : "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
      } ${available ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}
      onClick={() => onToggle(!active)}
    >
      <div className="flex items-center gap-2 md:gap-3">
        <div
          className={`p-1.5 md:p-2 rounded-full ${
            active ? "bg-hot-100 dark:bg-hot-400/20" : "bg-gray-200 dark:bg-white/10"
          }`}
        >
          <TrendingUp
            size={16}
            className={`md:w-[18px] md:h-[18px] ${
              active ? "text-hot-500 dark:text-hot-400" : "text-gray-500 dark:text-gray-400"
            }`}
          />
        </div>
        <div className="flex flex-col">
          <span
            className={`text-xs md:text-sm font-black ${
              active ? "text-hot-500 dark:text-hot-400" : "text-gray-700 dark:text-gray-300"
            }`}
          >
            상단 부스트 사용하기
          </span>
          <span className="text-[10px] md:text-xs text-gray-500 mt-0.5 font-medium">
            {BOOST_LIMIT_HINT[rank]} · 이번 달 남은 횟수{" "}
            <strong className="text-lime-500">{remaining}</strong> / {limit}
          </span>
        </div>
      </div>
      <div
        className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          active ? "bg-hot-400 border-hot-400" : "border-gray-300 dark:border-gray-600"
        }`}
      >
        {active && (
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>
        )}
      </div>
    </div>
  );
}
