"use client";

import React, { useEffect, useState, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { 
  Send, X, Users, Paperclip, User, LogIn, LogOut, 
  Trash2, Calendar, MapPin, Clock, CalendarPlus, Check, Minimize2, MessageCircle 
} from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
// 🔥 [로직 해석] 배포 환경 대응을 위한 공통 API 및 주소 설정 import
import { apiFetch, SOCKET_BASE_URL, API_BASE_URL } from "../lib/api";

/**
 * [로직 해석] Props 인터페이스 정의
 * GlobalChatManager 등 외부에서 넘겨주는 데이터의 타입을 명시합니다.
 * 이 부분이 정의되어 있어야 "Property 'postId' does not exist" 에러가 해결됩니다.
 */
interface MateChatModalProps {
  postId: number;
  postTitle: string;
  nickname: string;
  userId: string;
  isAuthor: boolean;
  onClose: () => void;
  onDeleteSuccess: () => void;
}

// 인터페이스 정의 (기존 로직 유지)
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

/**
 * [구조 해석] MateChatModal 컴포넌트
 * 🔥 [수정] 아래와 같이 파라미터 부분에 MateChatModalProps 타입을 명시적으로 연결했습니다.
 */
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

  /**
   * [로직 해석] 채팅 데이터 로드 및 소켓 연결
   */
  useEffect(() => {
    // 1. 기존 채팅 내역 로드 (apiFetch 사용)
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

    // 2. 소켓 연결 설정 (SOCKET_BASE_URL 사용)
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

  /**
   * [로직 해석] 파일 업로드 처리
   */
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

  const parsePromiseData = (msg: string) => {
    const parts = msg.split('|');
    return { date: parts[1], time: parts[2], location: parts[3] };
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
    alert(`📅 일정이 등록되었습니다!\n날짜: ${p.date}\n장소: ${p.location}`);
  };

  /**
   * [구조 해석] JSX 렌더링
   * 드래그 가능한 모달 구조를 유지합니다.
   */
  return (
    <div className="fixed inset-0 z-50 pointer-events-none" ref={constraintsRef}>
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
            className="absolute bottom-10 right-10 w-[400px] h-[600px] bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col pointer-events-auto"
          >
            {/* 헤더 영역 */}
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="bg-indigo-600 p-4 text-white flex items-center justify-between cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm truncate max-w-[180px]">{postTitle}</h3>
                  <p className="text-[10px] opacity-80">실시간 동행 채팅</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                  <Minimize2 size={16} />
                </button>
                <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 채팅창 영역 (기존 JSX 로직 동일) */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#121212] custom-scrollbar">
               {messages.map((msg, idx) => {
                 const isMe = msg.sender === nickname;
                 const isSystem = checkIsSystem(msg.message);
                 const isImage = msg.type === 'IMAGE' || checkIsImage(msg.message);
                 const isPromise = msg.type === 'PROMISE';

                 if (isSystem) {
                    return (
                      <div key={idx} className="flex justify-center">
                        <span className="bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[10px] px-3 py-1 rounded-full">
                          {msg.message}
                        </span>
                      </div>
                    );
                 }

                 if (isPromise) {
                    const p = parsePromiseData(msg.message);
                    return (
                      <div key={idx} className="flex justify-center">
                        <div className="bg-white dark:bg-[#2a2a2a] border border-indigo-100 dark:border-indigo-500/30 rounded-2xl p-4 shadow-md w-full max-w-[280px]">
                           <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs mb-3">
                             <CalendarPlus size={14}/> 약속이 도착했습니다!
                           </div>
                           <div className="space-y-2 mb-4 text-sm">
                             <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Calendar size={14}/> {p.date}</div>
                             <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Clock size={14}/> {p.time}</div>
                             <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><MapPin size={14}/> {p.location}</div>
                           </div>
                           <button onClick={() => addToCalendar(p)} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                             <Check size={14}/> 내 캘린더에 추가
                           </button>
                        </div>
                      </div>
                    );
                 }

                 return (
                   <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {!isMe && <span className="text-[10px] text-gray-500 mb-1 ml-1">{msg.sender}</span>}
                        {isImage ? (
                           <div className="rounded-2xl overflow-hidden border-2 border-white dark:border-[#333] shadow-sm">
                             <img 
                                src={getImageUrl(msg)} 
                                alt="Shared" 
                                className="max-w-full max-h-[200px] object-cover cursor-pointer"
                                onClick={() => window.open(getImageUrl(msg), '_blank')}
                             />
                           </div>
                        ) : (
                           <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-white rounded-tl-none"}`}>
                             {msg.message}
                           </div>
                        )}
                        <span className="text-[9px] text-gray-400 mt-1 mx-1">{formatTime(msg.sendTime)}</span>
                      </div>
                   </div>
                 );
               })}
            </div>

            {/* 입력 영역 */}
            <div className="p-4 bg-white dark:bg-[#1e1e1e] border-t border-gray-100 dark:border-white/5 space-y-3">
               {showPromiseForm && (
                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-gray-50 dark:bg-black/20 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-500/30 space-y-2">
                    <div className="flex gap-2">
                       <input type="date" value={promiseDetails.date} onChange={e => setPromiseDetails({...promiseDetails, date: e.target.value})} className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-[#333] border-none focus:ring-1 ring-indigo-500 outline-none" />
                       <input type="time" value={promiseDetails.time} onChange={e => setPromiseDetails({...promiseDetails, time: e.target.value})} className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-[#333] border-none focus:ring-1 ring-indigo-500 outline-none" />
                    </div>
                    <input type="text" placeholder="장소 입력" value={promiseDetails.location} onChange={e => setPromiseDetails({...promiseDetails, location: e.target.value})} className="w-full text-xs p-2 rounded-lg bg-white dark:bg-[#333] border-none focus:ring-1 ring-indigo-500 outline-none" />
                    <div className="flex gap-2">
                       <button onClick={sendPromise} className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg">발송</button>
                       <button onClick={() => setShowPromiseForm(false)} className="px-3 py-2 bg-gray-200 dark:bg-[#444] text-gray-600 dark:text-gray-300 text-[10px] rounded-lg">취소</button>
                    </div>
                 </motion.div>
               )}

               <div className="flex items-center gap-2">
                 <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                   <Paperclip size={20} />
                 </button>
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                 <input 
                   type="text" 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && sendMessage()}
                   placeholder="메시지를 입력하세요..."
                   className="flex-1 bg-gray-100 dark:bg-black/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none dark:text-white"
                 />
                 <button onClick={sendMessage} className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                   <Send size={18} />
                 </button>
               </div>

               <div className="flex items-center justify-between px-1">
                  <button onClick={() => setShowPromiseForm(!showPromiseForm)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Calendar size={12}/> 약속잡기
                  </button>
                  <div className="flex gap-3">
                    <button onClick={handleLeaveChat} className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                      <LogOut size={12}/> 나가기
                    </button>
                    {isAuthor && (
                      <button onClick={handleDeleteRoom} className="text-[10px] text-red-400 hover:text-red-600 font-bold flex items-center gap-1 transition-colors">
                        <Trash2 size={12}/> 폭파하기
                      </button>
                    )}
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          /* 최소화 상태 버튼 */
          <motion.div 
            key="minimized"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => setIsMinimized(false)}
            className="absolute bottom-10 right-10 w-16 h-16 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white cursor-pointer hover:scale-110 transition-transform pointer-events-auto"
          >
            <MessageCircle size={30} />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold">!</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}