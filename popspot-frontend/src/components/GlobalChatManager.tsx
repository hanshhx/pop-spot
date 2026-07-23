'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import MateChatModal from './MateChatModal';
import { notify } from '@/lib/notify';

// TypeScript가 MateChatModal에 어떤 값이 들어가는지 명확히 알 수 있도록
// 컴포넌트 내부에서 사용하는 Props 타입을 인터페이스로 정의합니다.
export default function GlobalChatManager() {
  const [isMounted, setIsMounted] = useState(false);
  const { activeChat, closeChat } = useChatStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 렌더링 상태 추적 로그
  // 브라우저 로딩 전이면 null
  if (!isMounted) return null;

  // 채팅방 데이터가 없으면 null
  if (!activeChat) {
    return null;
  }

  return (
    <MateChatModal
      postId={activeChat.postId}
      postTitle={activeChat.postTitle}
      nickname={activeChat.nickname}
      userId={activeChat.userId}
      isAuthor={activeChat.isAuthor}
      onClose={closeChat}
      onDeleteSuccess={() => {
        notify('채팅방이 삭제되었습니다.');
        closeChat();
      }}
    />
  );
}
