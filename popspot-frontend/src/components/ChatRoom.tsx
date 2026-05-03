"use client";

import React, { useEffect, useState, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Send, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
// 🔥 [수정 1] apiFetch 및 SOCKET_BASE_URL import
import { apiFetch, SOCKET_BASE_URL, API_BASE_URL } from "../lib/api";

interface Message {
  id: number;
  roomId: number;
  sender: string;
  message: string;
  sendTime: string;
  type?: string; 
}

interface Props {
  roomId: number;
  nickname: string;
}

export default function ChatRoom({ roomId, nickname }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const client = useRef<Client | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. 소켓 및 데이터 로드
  useEffect(() => {
    // 1-1) 과거 채팅 히스토리 로드 → state 채우기
    apiFetch(`/api/chat/history/${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(err => console.error("히스토리 로드 실패:", err));

    // 1-2) WebSocket 연결 + 구독 → 새 메시지 들어올 때마다 state 추가
    const socketFactory = () => new SockJS(`${SOCKET_BASE_URL}/ws-stomp`);

    client.current = new Client({
      webSocketFactory: socketFactory,
      onConnect: () => {
        client.current?.subscribe(`/sub/chat/room/${roomId}`, (res) => {
          const newMessage = JSON.parse(res.body);
          setMessages(prev => [...prev, newMessage]);
        });
      },
    });
    client.current.activate();
    return () => { if (client.current) client.current.deactivate(); };
  }, [roomId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !client.current?.connected) return;
    const payload = { sender: nickname || "익명", message: input, type: 'TALK' };
    client.current.publish({ destination: `/pub/chat/message/${roomId}`, body: JSON.stringify(payload) });
    setInput("");
  };

  return (
    // 🔥 반응형 높이 및 라운딩 적용 (h-[450px] md:h-[600px])
    <div className="flex flex-col h-[450px] md:h-[600px] bg-[#bacee0] dark:bg-[#1e1e1e] rounded-2xl md:rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-xl">
      <div className="bg-[#a9bdce] dark:bg-[#2a2a2a] p-3 md:p-4 flex items-center justify-between shadow-sm z-10">
        <h3 className="font-bold text-sm md:text-base text-gray-800 dark:text-white flex items-center gap-1.5 md:gap-2">💬 실시간 톡방</h3>
        <span className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">LIVE</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg, idx) => {
            const isMe = msg.sender === nickname;
            const content = msg.message || ""; // null 방지

            // 🔥 [강제 확인 로직] 조건을 아주 단순하게 변경
            // 1. "입장" 또는 "퇴장"이라는 글자가 포함되면 무조건 시스템 메시지
            const isSystem = content.includes("입장") || content.includes("퇴장");

            // 2. 파일 확장자가 있으면 무조건 이미지 (.png, .jpg 등 대소문자 무시)
            const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(content);

            // 🐞 [디버깅 로그] 브라우저 콘솔(F12)에서 이 로그가 찍히는지 확인하세요.
            // 만약 이 로그가 안 찍히면 코드가 갱신되지 않은 것입니다.
            // console.log(`MSG[${idx}]: ${content} / System: ${isSystem} / Image: ${isImage}`);

            // [CASE 1] 시스템 메시지 (회색 알약)
            if (isSystem) {
                return (
                    <motion.div 
                        key={msg.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center my-3 md:my-4"
                    >
                        <div className="bg-black/20 dark:bg-white/10 text-white dark:text-gray-300 text-[9px] md:text-[11px] px-2.5 py-1 md:px-3 md:py-1 rounded-full flex items-center gap-1">
                            {content.includes("입장") ? "👋" : "🚪"} {content}
                        </div>
                    </motion.div>
                );
            }

            // [CASE 2] 일반 메시지
            return (
              <motion.div 
                key={msg.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
              >
                {!isMe && (
                  <div className="mr-2 flex flex-col items-center">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-white rounded-full flex items-center justify-center border border-gray-200 overflow-hidden">
                        <User size={14} className="md:w-4 md:h-4 text-gray-400"/>
                    </div>
                  </div>
                )}
                
                {/* 🔥 모바일에서는 말풍선 허용 길이를 80%로 살짝 늘림 */}
                <div className={`max-w-[80%] md:max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {!isMe && <span className="text-[9px] md:text-[10px] text-gray-600 dark:text-gray-400 mb-0.5 md:mb-1 ml-1">{msg.sender}</span>}
                  
                  {isImage ? (
                    // 🖼️ 이미지 표시 (크기 반응형 조절)
                    <div className={`overflow-hidden rounded-lg md:rounded-xl border-[3px] md:border-4 ${isMe ? "border-[#ffeb33]" : "border-white dark:border-[#333]"} shadow-sm`}>
                         {/* 🔥 [수정 4] 이미지 경로도 API_BASE_URL을 사용하여 배포 환경 대응 */}
                         <img
                            src={`${API_BASE_URL}/uploads/${content.trim()}`}
                            alt="공유된 이미지"
                            loading="lazy"
                            className="max-w-[150px] max-h-[150px] md:max-w-[200px] md:max-h-[200px] object-cover block cursor-pointer"
                            onClick={() => window.open(`${API_BASE_URL}/uploads/${content.trim()}`, '_blank')}
                          />
                    </div>
                  ) : (
                    // 📝 텍스트 표시 (폰트, 패딩 조절)
                    <div className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm shadow-sm relative break-all
                        ${isMe 
                        ? "bg-[#ffeb33] text-black rounded-l-xl md:rounded-l-2xl rounded-tr-xl md:rounded-tr-2xl rounded-br-md" 
                        : "bg-white dark:bg-[#333] text-gray-900 dark:text-white rounded-r-xl md:rounded-r-2xl rounded-tl-xl md:rounded-tl-2xl rounded-bl-md"
                        }`}
                    >
                        {content}
                    </div>
                  )}

                  <span className="text-[8px] md:text-[9px] text-gray-500 mt-1 mx-1">
                    {msg.sendTime ? new Date(msg.sendTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "방금"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="bg-white dark:bg-[#2a2a2a] p-2 md:p-3 flex gap-1.5 md:gap-2 items-center">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="메시지 입력"
          className="flex-1 bg-gray-100 dark:bg-black/20 rounded-full px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm focus:outline-none dark:text-white"
        />
        <button onClick={sendMessage} aria-label="메시지 전송" className="p-2 md:p-3 bg-[#ffeb33] hover:bg-[#ffe600] rounded-full text-black shadow-sm shrink-0">
          <Send size={16} className="md:w-[18px
] md:h-[18px]" />
        </button>
      </div>
    </div>
  );
}
