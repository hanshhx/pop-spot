/**
 * v2.18.1 — 사용자 알림 큐 (클라이언트 로컬).
 *
 * <p>의견 답변 / 동행 채팅 / 시스템 알림 등을 통합 큐에 모아 헤더의 종 아이콘에서 한 번에 본다.
 * localStorage 기반이라 PIPA 부담 0. 회원/게스트 무관.
 *
 * <p>설계 결정:
 * <ul>
 *   <li>최대 30개 보관. 30개 넘으면 가장 오래된 것부터 삭제 (FIFO)
 *   <li>읽음 / 미확인 상태 따로 관리 — 미확인 개수만 뱃지에 노출
 *   <li>"전체 읽음 표시" 한 번에 모두 read=true 로 토글 가능
 *   <li>type 별로 색깔 / 아이콘 다르게 (UI 컴포넌트에서 처리)
 * </ul>
 */

const STORAGE_KEY = "popspot:notifications";
const MAX_ITEMS = 30;

export type NotificationType =
  | "feedback_reply"
  | "mate_chat"
  | "wishlist_expiring"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** 클릭 시 이동할 경로 (선택). 예: "/feedback" 또는 "/?tab=MATE" */
  href?: string;
  read: boolean;
  /** ISO timestamp. */
  createdAt: string;
}

export function pushNotification(
  notification: Omit<AppNotification, "id" | "read" | "createdAt">,
): void {
  if (typeof window === "undefined") return;
  const list = readNotifications();
  const next: AppNotification = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  const updated = [next, ...list].slice(0, MAX_ITEMS);
  writeNotifications(updated);
  // 같은 탭 안의 다른 구독자에게 알림.
  window.dispatchEvent(new CustomEvent("popspot:notifications-changed"));
}

export function readNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function unreadCount(): number {
  return readNotifications().filter((n) => !n.read).length;
}

export function markAsRead(id: string): void {
  const list = readNotifications();
  const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  writeNotifications(updated);
  notifyChange();
}

export function markAllAsRead(): void {
  const list = readNotifications();
  const updated = list.map((n) => ({ ...n, read: true }));
  writeNotifications(updated);
  notifyChange();
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  notifyChange();
}

function writeNotifications(list: AppNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* localStorage 가득 차거나 사용 불가 시 무시 */
  }
}

function notifyChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("popspot:notifications-changed"));
}
