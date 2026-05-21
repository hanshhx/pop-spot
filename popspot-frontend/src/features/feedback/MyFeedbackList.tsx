"use client";

import { useEffect, useState } from "react";

import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  type Feedback,
} from "@/types/feedback";

import { fetchMyFeedback } from "./api";

interface MyFeedbackListProps {
  /** 로그인 사용자 ID. 없으면 안내 문구만 표시. */
  userId: string | null;
  /** 외부에서 강제 새로고침이 필요할 때 증가시키는 값 (작성 직후 등). */
  refreshKey?: number;
  /** 한 번에 표시할 최대 개수. 미지정이면 전체. */
  limit?: number;
  /** 비어 있을 때 보여줄 문구. */
  emptyText?: string;
}

/**
 * 본인이 보낸 의견 목록.
 *
 * <p>마이페이지 카드와 {@code /feedback} 페이지에서 같은 모양으로 재사용한다. limit 만 다르게 줘서
 * MY 탭에서는 최근 3건, 전용 페이지에서는 전체를 노출.
 */
export function MyFeedbackList({
  userId,
  refreshKey = 0,
  limit,
  emptyText = "아직 보낸 의견이 없습니다.",
}: MyFeedbackListProps) {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    fetchMyFeedback()
      .then((data) => {
        if (cancelled) return;
        setItems(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "목록을 불러오지 못했습니다.";
        setErrorMessage(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  if (!userId) {
    return (
      <p className="text-sm text-muted-foreground">
        로그인하면 보낸 의견과 답변을 확인할 수 있습니다.
      </p>
    );
  }
  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중...</p>;
  }
  if (errorMessage) {
    return <p className="text-sm text-danger">{errorMessage}</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const visible = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <ul className="flex flex-col gap-3">
      {visible.map((f) => (
        <li
          key={f.id}
          className="rounded-md border border-[var(--color-border-strong)] bg-surface p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {CATEGORY_LABEL[f.category]} · {formatDate(f.createdAt)}
            </span>
            <span className="text-xs font-semibold">
              {STATUS_LABEL[f.status]}
            </span>
          </div>
          <p className="mt-1 truncate font-medium text-surface-foreground">
            {f.title}
          </p>
          {f.adminReply && (
            <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs text-foreground">
              답변: {f.adminReply}
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
