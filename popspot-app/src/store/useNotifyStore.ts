import * as Notifications from 'expo-notifications';
import { create } from 'zustand';

import {
  DEFAULT_NOTIFY_SETTINGS,
  canNotify,
  pruneSent,
  type NotifyDecision,
  type NotifyKind,
  type NotifySettings,
  type SentRecord,
} from '@/lib/notifyRules';
import { attachPersist } from './persist';

/**
 * 알림 설정과 보낸 기록, 그리고 앱 안 알림함.
 *
 * <p>세 가지가 한 곳에 있는 이유는 <b>서로를 보지 않으면 규칙을 지킬 수 없기 때문</b>이다. 보낼지
 * 말지는 설정과 기록을 함께 봐야 정해지고({@code lib/notifyRules.ts}), 보낸 것은 알림함에도
 * 남아야 한다.
 *
 * <p>웹은 {@code NotificationCenter} 가 localStorage 큐(최대 30개, 읽음 상태)를 들고 있다. 같은
 * 모양을 앱으로 옮긴다.
 */

/** 알림함에 남는 한 줄. */
export interface InboxItem {
  id: string;
  kind: NotifyKind;
  title: string;
  body: string;
  at: number;
  read: boolean;
  /** 눌렀을 때 열 팝업. 없으면 목록으로. */
  popupId: number | null;
}

/** 웹과 같은 상한. 더 쌓아 둬도 아무도 안 읽는다. */
const INBOX_LIMIT = 30;

interface NotifyStore {
  settings: NotifySettings;
  sent: SentRecord[];
  inbox: InboxItem[];
  setSetting: (kind: NotifyKind, on: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** 규칙을 통과하면 실제로 알림을 띄우고 기록·알림함에 남긴다. */
  notify: (input: {
    kind: NotifyKind;
    title: string;
    body: string;
    popupId: number | null;
  }) => Promise<NotifyDecision>;
  /** 규칙을 무시하고 알림함에만 넣는다. */
  pushToInbox: (item: Omit<InboxItem, 'id' | 'at' | 'read'>) => void;
}

let counter = 0;

/**
 * 알림함 항목 id.
 *
 * <p>{@code Date.now()} 만 쓰면 같은 밀리초에 두 개가 들어올 때 겹친다 — 주간 요약과 마감 알림이
 * 같은 순간에 도착하는 경우가 실제로 있다. 세는 값을 붙인다.
 */
function nextId(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export const useNotifyStore = create<NotifyStore>()((set, get) => ({
  settings: DEFAULT_NOTIFY_SETTINGS,
  sent: [],
  inbox: [],

  setSetting: (kind, on) => set((state) => ({ settings: { ...state.settings, [kind]: on } })),

  markRead: (id) =>
    set((state) => ({
      inbox: state.inbox.map((i) => (i.id === id ? { ...i, read: true } : i)),
    })),

  markAllRead: () => set((state) => ({ inbox: state.inbox.map((i) => ({ ...i, read: true })) })),

  notify: async ({ kind, title, body, popupId }) => {
    const now = new Date();
    const { settings, sent } = get();
    const decision = canNotify({ kind, popupId }, settings, sent, now);
    if (!decision.send) return decision;

    try {
      /* trigger 가 null 이면 즉시 띄운다. 예약은 발송 시점에 규칙을 다시 볼 수 없어서 쓰지
         않는다 — 예약해 둔 사이에 사용자가 알림을 껐을 수 있다. */
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    } catch {
      /* 권한이 없거나 기기가 거부하면 화면 안 알림함에는 남긴다. 앱을 열었을 때는 보인다. */
    }

    set((state) => ({
      sent: pruneSent([...state.sent, { kind, popupId, at: now.getTime() }], now),
      inbox: [
        { id: nextId(), kind, title, body, at: now.getTime(), read: false, popupId },
        ...state.inbox,
      ].slice(0, INBOX_LIMIT),
    }));

    return decision;
  },

  pushToInbox: (item) =>
    set((state) => ({
      inbox: [{ ...item, id: nextId(), at: Date.now(), read: false }, ...state.inbox].slice(
        0,
        INBOX_LIMIT,
      ),
    })),
}));

attachPersist(useNotifyStore, {
  name: 'popspot-notify',
  pick: (s) => ({ settings: s.settings, sent: s.sent, inbox: s.inbox }),
});

/** 안 읽은 개수 — 홈 종 아이콘의 배지. */
export function unreadCount(inbox: InboxItem[]): number {
  return inbox.filter((i) => !i.read).length;
}
