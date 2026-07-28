'use client';

import { useEffect, useState } from 'react';

import { useLocale, type MessageKey } from '@/lib/i18n';
import type { Feedback, FeedbackCategory, FeedbackStatus } from '@/types/feedback';

import { fetchMyFeedback } from './api';

interface MyFeedbackListProps {
  /** 로그인 사용자 ID. 없으면 안내 문구만 표시. */
  userId: string | null;
  /** 외부에서 강제 새로고침이 필요할 때 증가시키는 값 (작성 직후 등). */
  refreshKey?: number;
  /** 한 번에 표시할 최대 개수. 미지정이면 전체. */
  limit?: number;
  /** 비어 있을 때 보여줄 문구. 미지정이면 화면 언어에 맞춘 기본 안내. */
  emptyText?: string;
}

/**
 * 카테고리·상태의 표시 문구만 사전에서 꺼낸다.
 *
 * <p>서버가 주는 값({@code BUG}, {@code PENDING} …)은 그대로 두고 라벨만 바꾼다. 공용
 * {@code CATEGORY_LABEL / STATUS_LABEL} 을 고치지 않은 것은 그 상수를 관리자 화면도 함께 쓰고 있어,
 * 지금 손대면 아직 옮기지 않은 화면의 문구까지 흔들리기 때문이다.
 */
const CATEGORY_LABEL_KEY: Record<FeedbackCategory, MessageKey> = {
  BUG: 'fb.catBug',
  FEATURE: 'fb.catFeature',
  GOOD: 'fb.catGood',
  OTHER: 'fb.catOther',
};

const STATUS_LABEL_KEY: Record<FeedbackStatus, MessageKey> = {
  PENDING: 'fb.statusPending',
  REVIEWING: 'fb.statusReviewing',
  RESOLVED: 'fb.statusResolved',
  WONT_FIX: 'fb.statusWontFix',
};

/**
 * 본인이 보낸 의견 목록.
 *
 * <p>마이페이지 카드와 {@code /feedback} 페이지에서 같은 모양으로 재사용한다. limit 만 다르게 줘서
 * MY 탭에서는 최근 3건, 전용 페이지에서는 전체를 노출.
 */
export function MyFeedbackList({ userId, refreshKey = 0, limit, emptyText }: MyFeedbackListProps) {
  const { t } = useLocale();
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  /**
   * 실패는 <b>문구가 아니라 상태로</b> 들고 있는다.
   *
   * <p>여기서 번역해 넣으면 t 가 이 효과의 의존성이 되어, 언어를 바꿀 때마다 이미 받아둔 목록을 버리고
   * 다시 불러오게 된다. 서버가 준 사유({@code reason})만 담아두고 문구는 그릴 때 고른다.
   */
  const [error, setError] = useState<{ reason: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMyFeedback()
      .then((data) => {
        if (cancelled) return;
        setItems(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError({ reason: err instanceof Error ? err.message : null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  if (!userId) {
    return <p className="text-sm text-muted-foreground">{t('fb.loginPrompt')}</p>;
  }
  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('fb.loading')}</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">{error.reason ?? t('fb.loadFailed')}</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText ?? t('fb.listEmpty')}</p>;
  }

  const visible = typeof limit === 'number' ? items.slice(0, limit) : items;

  return (
    <ul className="flex flex-col gap-3">
      {visible.map((f) => (
        <li
          key={f.id}
          className="rounded-md border border-[var(--color-border-strong)] bg-surface p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t(CATEGORY_LABEL_KEY[f.category])} · {formatDate(f.createdAt)}
            </span>
            <span className="text-xs font-semibold">{t(STATUS_LABEL_KEY[f.status])}</span>
          </div>
          <p className="mt-1 truncate font-medium text-surface-foreground">{f.title}</p>
          {f.adminReply && (
            <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs text-foreground">
              {t('fb.replyPrefix')} {f.adminReply}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** YYYY-MM-DD 만 잘라 표시. ISO 시각이라 처음 10자리로 충분. */
function formatDate(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}
