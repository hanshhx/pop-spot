"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore"; 
import MateChatModal from "./MateChatModal"; 

// 🔥 [해결 로직] 
// TypeScript가 MateChatModal에 어떤 값이 들어가는지 명확히 알 수 있도록 
// 컴포넌트 내부에서 사용하는 Props 타입을 인터페이스로 정의합니다.
interface MateChatModalProps {
  postId: number;
  postTitle: string;
  nickname: string;
  userId: string;
  isAuthor: boolean;
  onClose: () => void;
  onDeleteSuccess: () => void;
}

export default function GlobalChatManager() {
  const [isMounted, setIsMounted] = useState(false);
  const { activeChat, closeChat } = useChatStore();

  useEffect(() => {
    console.log("🔥 [Manager] 컴포넌트 마운트됨 (페이지 로드 완료)");
    setIsMounted(true);

    return () => {
      console.log("☠️ [Manager] 컴포넌트 언마운트됨 (삭제됨)");
    };
  }, []);

  // 렌더링 상태 추적 로그
  useEffect(() => {
    if (isMounted) {
      console.log("🔥 [Manager] 현재 상태 - activeChat:", activeChat ? "있음" : "없음 (null)");
    }
  }, [isMounted, activeChat]);

  // 브라우저 로딩 전이면 null
  if (!isMounted) return null;

  // 채팅방 데이터가 없으면 null
  if (!activeChat) {
    return null; 
  }

  // 🔥 [해결] 넘겨주는 데이터 형식을 인터페이스와 일치시킵니다.
  return (
    <MateChatModal
      postId={activeChat.postId}
      postTitle={activeChat.postTitle}
      nickname={activeChat.nickname}
      userId={activeChat.userId}
      isAuthor={activeChat.isAuthor}
      onClose={closeChat} 
      onDeleteSuccess={() => {
        alert("채팅방이 삭제되었습니다.");
        closeChat();
      }}
    />
  );
}