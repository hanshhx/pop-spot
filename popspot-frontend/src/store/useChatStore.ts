import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * 동행 채팅방 전역 상태 (Zustand + localStorage 영속).
 *
 * <p>같은 사용자가 여러 탭을 열어도 채팅방이 동일하게 유지되며, 새로고침 시에도 마지막 활성 채팅방이
 * 복원된다. 최소화 상태 (`isMinimized`) 는 글로벌 채팅 매니저가 미니/풀 뷰를 토글할 때 참조.
 */

export interface ChatRoomInfo {
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
  minimizeChat: (minimized: boolean) => void;
}

const STORAGE_KEY = 'popspot-chat-storage';

export const useChatStore = create(
  persist<ChatStore>(
    (set) => ({
      activeChat: null,
      isMinimized: false,

      openChat: (info) => set({ activeChat: info, isMinimized: false }),
      closeChat: () => set({ activeChat: null }),
      minimizeChat: (minimized) => set({ isMinimized: minimized }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
