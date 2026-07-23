'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, CheckCheck, MessageCircle, Heart, Info, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import {
  type AppNotification,
  type NotificationType,
  clearAll,
  markAllAsRead,
  markAsRead,
  readNotifications,
} from '@/lib/notifications';

interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  feedback_reply: <MessageCircle className="size-4 text-lime-500" />,
  mate_chat: <Users className="size-4 text-hot-400" />,
  wishlist_expiring: <Heart className="size-4 text-pink-500" />,
  system: <Info className="size-4 text-muted-foreground" />,
};

/**
 * v2.18.1 — 통합 알림 센터. 헤더의 종 아이콘 클릭 시 열리며 의견 답변 / 동행 채팅 / 위시 만료
 * 알림 등을 한 화면에 모아 보여준다.
 *
 * <p>현재는 localStorage 기반 클라이언트 알림만 — 백엔드 push 는 다음 라운드 (Web Push API).
 */
export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (open) setItems(readNotifications());
  }, [open]);

  // 다른 탭 / 컴포넌트에서 알림 변경 시 동기화.
  useEffect(() => {
    const onChange = () => setItems(readNotifications());
    window.addEventListener('popspot:notifications-changed', onChange);
    return () => window.removeEventListener('popspot:notifications-changed', onChange);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-5" aria-hidden /> 알림
          </DialogTitle>
          <DialogDescription>
            의견 답변 · 동행 채팅 · 시스템 안내를 한 곳에서 확인합니다.
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <EmptyState
            icon={<BellOff className="size-8" />}
            title="알림이 없습니다"
            description="새로운 답변이나 안내가 도착하면 여기에 표시됩니다."
            bordered={false}
          />
        ) : (
          <>
            <div className="flex items-center justify-end gap-2 mb-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<CheckCheck className="size-3.5" />}
                onClick={() => {
                  markAllAsRead();
                  setItems(readNotifications());
                }}
              >
                모두 읽음
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearAll();
                  setItems([]);
                }}
              >
                모두 삭제
              </Button>
            </div>
            <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationRow
                    notification={item}
                    onClick={() => {
                      if (!item.read) {
                        markAsRead(item.id);
                        setItems(readNotifications());
                      }
                      if (item.href) onOpenChange(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotificationRow({
  notification,
  onClick,
}: {
  notification: AppNotification;
  onClick: () => void;
}) {
  const body = (
    <div
      className={
        'flex items-start gap-3 p-3 rounded-md border transition-colors ' +
        (notification.read
          ? 'border-[var(--color-border)] bg-surface'
          : 'border-lime-300/40 bg-lime-300/5')
      }
    >
      <div className="mt-0.5 shrink-0">{TYPE_ICON[notification.type]}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDate(notification.createdAt)}
        </p>
      </div>
      {!notification.read && (
        <span className="mt-1.5 size-2 rounded-full bg-lime-500 shrink-0" aria-label="안 읽음" />
      )}
    </div>
  );

  return notification.href ? (
    <Link href={notification.href} onClick={onClick} className="block">
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className="w-full text-left">
      {body}
    </button>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}
