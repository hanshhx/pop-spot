"use client";

import React, { useEffect, useState, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { 
  Send, X, Users, Paperclip, User, LogIn, LogOut, 
  Trash2, Calendar, MapPin, Clock, CalendarPlus, Check, Minimize2, MessageCircle, Sparkles 
} from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { apiFetch, SOCKET_BASE_URL, API_BASE_URL } from "../lib/api";

interface MateChatModalProps {
  postId: number;
  postTitle: string;
  nickname: string;
  userId: string;
  isAuthor: boolean;
  onClose: () => void;
  onDeleteSuccess: () => void;
}

interface Message {
  sender: string;
  message: string;
  type: 'TALK' | 'IMAGE' | 'FILE' | 'PROMISE' | 'JOIN' | 'LEAVE';
  sendTime: string;
  fileUrl?: string;
}

interface PromiseData {
  date: string;
  time: string;
  location: string;
}

export default function MateChatModal({ 
  postId, 
  postTitle, 
  nickname, 
  onClose, 
  userId, 
  isAuthor, 
  onDeleteSuccess 
}: MateChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showPromiseForm, setShowPromiseForm] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragControls = useDragControls();
  const isDraggingRef = useRef(false);
  const [promiseDetails, setPromiseDetails] = useState<PromiseData>({ 
    date: new Date().toISOString().split('T')[0], 
    time: "14:00", 
    location: "더현대 서울" 
  });
  
  const client = useRef<Client | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const constraintsRef = useRef(null);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    } catch(e) { return dateStr; }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return ""; }
  };

  useEffect(() => {
    apiFetch(`/api/mates/${postId}/chat`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
        else setMessages([]);
      })
      .catch((err) => {
        console.error("채팅 로드 실패:", err);
        setMessages([]);
      });

    const socket = new SockJS(`${SOCKET_BASE_URL}/ws-stomp`);
    
    client.current = new Client({
      webSocketFactory: () => socket,
      debug: () => {},
      onConnect: () => {
        console.log("✅ 채팅 소켓 연결됨");
        client.current?.subscribe(`/sub/mate/chat/${postId}`, (res) => {
          const newMsg = JSON.parse(res.body);
          setMessages((prev) => [...prev, newMsg]);
        });
      },
    });

    client.current.activate();
    return () => { client.current?.deactivate(); };
  }, [postId, nickname]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !client.current?.connected) return;
    const payload = { 
        sender: nickname, 
        message: input, 
        type: 'TALK',
        sendTime: new Date().toISOString()
    };
    client.current.publish({ 
        destination: `/pub/mate/chat/${postId}`, 
        body: JSON.stringify(payload) 
    });
    setInput("");
  };

  const sendPromise = () => {
    if (!client.current?.connected) return;
    const promiseStr = `📅약속|${promiseDetails.date}|${promiseDetails.time}|${promiseDetails.location}`;
    const payload = {
      sender: nickname,
      message: promiseStr,
      type: 'PROMISE',
      sendTime: new Date().toISOString()
    };
    client.current.publish({ 
        destination: `/pub/mate/chat/${postId}`, 
        body: JSON.stringify(payload) 
    });
    setShowPromiseForm(false);
  };

  const handleLeaveChat = () => {
    if (!confirm("채팅방에서 나가시겠습니까?")) return;
    onClose();
  };

  const handleDeleteRoom = async () => {
    if (!confirm("정말 폭파하시겠습니까? 팀원들의 채팅방도 모두 삭제됩니다.")) return;
    try {
      const res = await apiFetch(`/api/mates/${postId}?userId=${userId}`, { method: "DELETE" });
      if (res.ok) {
        alert("채팅방이 폭파되었습니다.");
        onDeleteSuccess(); 
      }
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client.current?.connected) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiFetch(`/api/chat/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("업로드 실패");
      const data = await res.json();
      
      let savedFileName = data.fileUrl;
      if (data.fileUrl && data.fileUrl.includes("/uploads/")) {
        savedFileName = data.fileUrl.split("/uploads/")[1];
      }
      const isImage = file.type.startsWith("image/");
      const fileMessage = {
        sender: nickname,
        message: savedFileName, 
        type: isImage ? 'IMAGE' : 'FILE',
        fileUrl: data.fileUrl,
        sendTime: new Date().toISOString()
      };
      client.current.publish({ 
          destination: `/pub/mate/chat/${postId}`, 
          body: JSON.stringify(fileMessage) 
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert("파일 전송 실패");
    }
  };

  // 🔥 [핵심 로직 수정] 문자열을 안전하게 파싱합니다.
  const parsePromiseData = (msg: string) => {
    const parts = msg.split('|');
    return { date: parts[1] || "", time: parts[2] || "", location: parts[3] || "" };
  };

  const checkIsSystem = (msg: string) => msg.includes("입장") || msg.includes("퇴장");
  const checkIsImage = (msg: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(msg);

  const getImageUrl = (msg: Message) => {
    let rawUrl = msg.fileUrl || `${API_BASE_URL}/uploads/${msg.message}`;
    if (msg.fileUrl && msg.fileUrl.startsWith("http")) return msg.fileUrl;
    const parts = rawUrl.split('/uploads/');
    if (parts.length === 2) {
        const filename = parts[1];
        try {
            const safeFilename = encodeURIComponent(decodeURIComponent(filename));
            return `${API_BASE_URL}/uploads/${safeFilename}`;
        } catch (e) {
            return `${API_BASE_URL}/uploads/${encodeURIComponent(filename)}`;
        }
    }
    return rawUrl;
  };

  const addToCalendar = (p: { date: string, time: string, location: string }) => {
    alert(`📅 일정이 내 캘린더에 등록되었습니다!\n\n날짜: ${p.date}\n시간: ${p.time}\n장소: ${p.location}`);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex justify-center items-end sm:items-auto" ref={constraintsRef}>
      <AnimatePresence mode="wait">
        {!isMinimized ? (
          <motion.div 
            key="maximized"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragConstraints={constraintsRef}
            onDragStart={() => (isDraggingRef.current = true)}
            onDragEnd={() => (isDraggingRef.current = false)}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            // 🔥 [반응형 수정] 모바일에서는 화면을 꽉 채우되 약간의 여백을 주고, PC에서는 우측 하단 고정
            className="absolute bottom-4 right-0 left-0 mx-auto w-[95%] h-[80vh] sm:m-0 sm:bottom-10 sm:right-10 sm:left-auto sm:w-[400px] sm:h-[600px] bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col pointer-events-auto"
          >
            {/* 헤더 영역 */}
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="bg-indigo-600 p-3 sm:p-4 text-white flex items-center justify-between cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg">
                  <MessageCircle size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[180px]">{postTitle}</h3>
                  <p className="text-[9px] sm:text-[10px] opacity-80">실시간 동행 채팅</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsMinimized(true)} className="p-1 sm:p-1.5 hover:bg-white/10 rounded-md transition-colors">
                  <Minimize2 size={14} className="sm:w-4 sm:h-4" />
                </button>
                <button onClick={onClose} className="p-1 sm:p-1.5 hover:bg-white/10 rounded-md transition-colors">
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
            </div>

            {/* 채팅창 영역 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-[#121212] custom-scrollbar">
               {messages.map((msg, idx) => {
                 const isMe = msg.sender === nickname;
                 const isSystem = checkIsSystem(msg.message);
                 const isImage = msg.type === 'IMAGE' || checkIsImage(msg.message);
                 
                 // 🔥 [핵심 수정] DB에서 type 속성이 사라져도 텍스트로 약속임을 정확히 판별합니다.
                 const isPromise = msg.type === 'PROMISE' || msg.message.startsWith('📅약속|');

                 if (isSystem) {
                    return (
                      <div key={idx} className="flex justify-center my-2">
                        <span className="bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[9px] sm:text-[10px] px-2.5 sm:px-3 py-1 rounded-full">
                          {msg.message}
                        </span>
                      </div>
                    );
                 }

                 // 🔥 [디자인 대폭 수정] 투박한 텍스트를 MZ 감성의 세련된 모바일 초대장 UI로 교체합니다.
                 if (isPromise) {
                    const p = parsePromiseData(msg.message);
                    return (
                      <div key={idx} className="flex justify-center my-3 sm:my-4 w-full">
                        <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg w-full max-w-[260px] sm:max-w-[300px] overflow-hidden group">
                            
                            {/* 장식용 배경 아이콘 */}
                            <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 text-indigo-500/10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                                <Calendar size={80} className="sm:w-[100px] sm:h-[100px]" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[8px] sm:text-[10px] font-black tracking-wider mb-3 sm:mb-4 uppercase">
                                    <Sparkles size={10} className="sm:w-3 sm:h-3"/> POP-SPOT INVITATION
                                </div>
                                
                                <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-white mb-3 sm:mb-4 leading-tight">
                                    우리 여기서<br/>만나는 거 어때요?
                                </h4>

                                <div className="space-y-2 mb-4 sm:mb-5 bg-white/60 dark:bg-black/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-white/50 dark:border-white/5">
                                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <Calendar size={12} className="sm:w-3.5 sm:h-3.5"/>
                                        </div>
                                        <span className="font-bold text-gray-800 dark:text-gray-200">{p.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                            <Clock size={12} className="sm:w-3.5 sm:h-3.5"/>
                                        </div>
                                        <span className="font-bold text-gray-800 dark:text-gray-200">{p.time}</span>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                            <MapPin size={12} className="sm:w-3.5 sm:h-3.5"/>
                                        </div>
                                        <span className="font-bold text-gray-800 dark:text-gray-200">{p.location}</span>
                                    </div>
                                </div>

                                <button onClick={() => addToCalendar(p)} className="w-full py-2.5 sm:py-3 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-0.5">
                                    <Check size={12} className="sm:w-3.5 sm:h-3.5" /> 일정 수락하고 저장하기
                                </button>
                            </div>
                        </div>
                      </div>
                    );
                 }

                 return (
                   <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"} my-1`}>
                      <div className={`max-w-[85%] sm:max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {!isMe && <span className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5 sm:mb-1 ml-1">{msg.sender}</span>}
                        {isImage ? (
                           <div className="rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white dark:border-[#333] shadow-sm">
                             <img 
                                src={getImageUrl(msg)} 
                                alt="Shared" 
                                className="max-w-full max-h-[150px] sm:max-h-[200px] object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                onClick={() => window.open(getImageUrl(msg), '_blank')}
                             />
                           </div>
                        ) : (
                           <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-sm ${isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-white rounded-tl-none"}`}>
                             {msg.message}
                           </div>
                        )}
                        <span className="text-[8px] sm:text-[9px] text-gray-400 mt-1 mx-1">{formatTime(msg.sendTime)}</span>
                      </div>
                   </div>
                 );
               })}
            </div>

            {/* 입력 영역 (반응형 폰트 및 패딩 조절) */}
            <div className="p-3 sm:p-4 bg-white dark:bg-[#1e1e1e] border-t border-gray-100 dark:border-white/5 space-y-2 sm:space-y-3">
               {showPromiseForm && (
                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-2 sm:p-3 bg-gray-50 dark:bg-black/20 rounded-xl sm:rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-500/30 space-y-1.5 sm:space-y-2">
                    <div className="flex gap-1.5 sm:gap-2">
                       <input type="date" value={promiseDetails.date} onChange={e => setPromiseDetails({...promiseDetails, date: e.target.value})} className="flex-1 text-[10px] sm:text-xs p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-white dark:bg-[#333] border border-gray-200 dark:border-white/10 focus:ring-2 ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                       <input type="time" value={promiseDetails.time} onChange={e => setPromiseDetails({...promiseDetails, time: e.target.value})} className="flex-1 text-[10px] sm:text-xs p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-white dark:bg-[#333] border border-gray-200 dark:border-white/10 focus:ring-2 ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                    </div>
                    <input type="text" placeholder="장소 입력 (예: 더현대 서울 팝업 앞)" value={promiseDetails.location} onChange={e => setPromiseDetails({...promiseDetails, location: e.target.value})} className="w-full text-[10px] sm:text-xs p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-white dark:bg-[#333] border border-gray-200 dark:border-white/10 focus:ring-2 ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                    <div className="flex gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                       <button onClick={sendPromise} className="flex-1 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-[11px] font-bold rounded-lg sm:rounded-xl transition-colors shadow-lg">초대장 발송하기</button>
                       <button onClick={() => setShowPromiseForm(false)} className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-[#444] dark:hover:bg-[#555] text-gray-700 dark:text-gray-200 text-[10px] sm:text-[11px] font-bold rounded-lg sm:rounded-xl transition-colors">취소</button>
                    </div>
                 </motion.div>
               )}

               <div className="flex items-center gap-1.5 sm:gap-2">
                 <button onClick={() => fileInputRef.current?.click()} className="p-1.5 sm:p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                   <Paperclip size={18} className="sm:w-5 sm:h-5"/>
                 </button>
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                 <input 
                   type="text" 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && sendMessage()}
                   placeholder="메시지를 입력하세요..."
                   className="flex-1 bg-gray-100 dark:bg-black/30 border border-transparent dark:border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 dark:text-white transition-colors"
                 />
                 <button onClick={sendMessage} className="p-2 sm:p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg sm:rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                   <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
                 </button>
               </div>

               <div className="flex items-center justify-between px-1">
                  <button onClick={() => setShowPromiseForm(!showPromiseForm)} className="text-[10px] sm:text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 sm:gap-1.5 transition-colors bg-indigo-50 dark:bg-indigo-900/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg">
                    <CalendarPlus size={12} className="sm:w-3.5 sm:h-3.5"/> 동행 약속잡기
                  </button>
                  <div className="flex gap-2 sm:gap-4">
                    <button onClick={handleLeaveChat} className="text-[10px] sm:text-[11px] font-medium text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                      <LogOut size={10} className="sm:w-3 sm:h-3"/> 나가기
                    </button>
                    {isAuthor && (
                      <button onClick={handleDeleteRoom} className="text-[10px] sm:text-[11px] text-red-500 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-bold flex items-center gap-1 transition-all">
                        <Trash2 size={10} className="sm:w-3 sm:h-3"/> 폭파하기
                      </button>
                    )}
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          /* 최소화 상태 버튼 (반응형 위치 조절) */
          <motion.div 
            key="minimized"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => setIsMinimized(false)}
            className="absolute bottom-4 right-4 sm:bottom-10 sm:right-10 w-12 h-12 sm:w-16 sm:h-16 bg-indigo-600 hover:bg-indigo-500 rounded-full shadow-[0_10px_25px_rgba(79,70,229,0.5)] flex items-center justify-center text-white cursor-pointer hover:scale-110 transition-all pointer-events-auto"
          >
            <MessageCircle size={24} className="sm:w-7 sm:h-7" />
            <div className="absolute top-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-pink-500 rounded-full border-2 border-white dark:border-[#1e1e1e] flex items-center justify-center animate-pulse"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}