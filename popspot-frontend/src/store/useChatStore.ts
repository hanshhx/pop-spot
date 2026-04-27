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
        set({ activeChat: info, isMinimized: false });
      },
      
      closeChat: () => {
        set({ activeChat: null });
      },
      
      minimizeChat: (val) => {
        set({ isMinimized: val });
      },
    }),
    {
      name: 'popspot-chat-storage', 
      storage: createJSONStorage(() => localStorage),
      
      // 🔥 [디버깅] 새로고침 후 데이터가 복구될 때 로그가 찍힙니다.
      onRehydrateStorage: () => (state) => {
      },
    }
  )
);