import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ChatRoomInfo {
  postId: number;
  postTitle: string;
  nickname: string;
  userId: string;
  isAuthor: boolean;
}

interface ChatStore {
  activeChat: ChatRoomInfo | null;
  isMinimized: boolean;
  openChat: (info: ChatRoomInfo) => void;
  closeChat: () => void;
  minimizeChat: (val: boolean) => void;
}

export const useChatStore = create(
  persist<ChatStore>(
    (set) => ({
      activeChat: null,
      isMinimized: false,
      
      openChat: (info) => {
        console.log("🔥 [Store] 채팅방 열기 요청:", info);
        set({ activeChat: info, isMinimized: false });
      },
      
      closeChat: () => {
        console.log("🔥 [Store] 채팅방 닫기 (데이터 삭제)");
        set({ activeChat: null });
      },
      
      minimizeChat: (val) => {
        console.log("🔥 [Store] 최소화 상태 변경:", val);
        set({ isMinimized: val });
      },
    }),
    {
      name: 'popspot-chat-storage', 
      storage: createJSONStorage(() => localStorage),
      
      // 🔥 [디버깅] 새로고침 후 데이터가 복구될 때 로그가 찍힙니다.
      onRehydrateStorage: () => (state) => {
        console.log("🔥 [Store] LocalStorage에서 상태 복구됨:", state);
      },
    }
  )
);