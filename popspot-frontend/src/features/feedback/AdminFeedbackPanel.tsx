'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { notifySuccess, notifyError, confirmAction } from '@/lib/notify';
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  type Feedback,
  type FeedbackStatus,
  type FeedbackStatusCounts,
} from '@/types/feedback';

import {
  deleteFeedback,
  fetchAdminFeedback,
  fetchAdminFeedbackMetrics,
  replyFeedback,
} from './api';

const STATUS_FILTERS: Array<{ value: FeedbackStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING', label: '확인 대기' },
  { value: 'REVIEWING', label: '검토 중' },
  { value: 'RESOLVED', label: '처리 완료' },
  { value: 'WONT_FIX', label: '반영 안함' },
];

const REPLY_STATUS_OPTIONS: FeedbackStatus[] = ['PENDING', 'REVIEWING', 'RESOLVED', 'WONT_FIX'];

const EMPTY_COUNTS: FeedbackStatusCounts = {
  PENDING: 0,
  REVIEWING: 0,
  RESOLVED: 0,
  WONT_FIX: 0,
};

/**
 * 어드민 의견 검수 패널.
 *
 * <p>상단에 상태별 카운트, 가운데 필터 + 목록, 항목 클릭 시 펼쳐서 답변/상태/삭제 처리.
 * 목록 조회 / 카운트 조회 / 답변 / 삭제 4종 API 만 호출.
 */
export function AdminFeedbackPanel() {
  const [filter, setFilter] = useState<FeedbackStatus | 'ALL'>('ALL');
  const [items, setItems] = useState<Feedback[]>([]);
  const [counts, setCounts] = useState<FeedbackStatusCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [list, metrics] = await Promise.all([
        fetchAdminFeedback(filter === 'ALL' ? {} : { status: filter }),
        fetchAdminFeedbackMetrics(),
      ]);
      setItems(list);
      setCounts({ ...EMPTY_COUNTS, ...metrics });
    } catch (err) {
      const message = err instanceof Error ? err.message : '목록을 불러오지 못했습니다.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <MetricRow counts={counts} />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={
                'rounded-md border px-3 py-1.5 text-sm transition-colors ' +
                (active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-[var(--color-border-strong)] bg-surface text-surface-foreground hover:bg-muted')
              }
            >
              {opt.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={reload}
          className="ml-auto rounded-md border border-[var(--color-border-strong)] bg-surface px-3 py-1.5 text-sm hover:bg-muted"
        >
          새로고침
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
      {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
      {!loading && !errorMessage && items.length === 0 && (
        <p className="text-sm text-muted-foreground">해당 조건의 의견이 없습니다.</p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((f) => (
          <li
            key={f.id}
            className="rounded-md border border-[var(--color-border-strong)] bg-surface p-4"
          >
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{CATEGORY_LABEL[f.category]}</span>
                  <span>·</span>
                  <span>{formatDate(f.createdAt)}</span>
                  <span>·</span>
                  <span>{authorLabel(f)}</span>
                </div>
                <p className="mt-1 truncate font-medium text-surface-foreground">{f.title}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold">{STATUS_LABEL[f.status]}</span>
            </button>

            {expandedId === f.id && (
              <ReplyEditor
                feedback={f}
                onSaved={(updated) => {
                  setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
                  reload();
                }}
                onDeleted={() => {
                  setItems((prev) => prev.filter((it) => it.id !== f.id));
                  setExpandedId(null);
                  reload();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MetricRowProps {
  counts: FeedbackStatusCounts;
}

function MetricRow({ counts }: MetricRowProps) {
  const cards: Array<{ key: FeedbackStatus; label: string }> = [
    { key: 'PENDING', label: '확인 대기' },
    { key: 'REVIEWING', label: '검토 중' },
    { key: 'RESOLVED', label: '처리 완료' },
    { key: 'WONT_FIX', label: '반영 안함' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.key}
          className="rounded-md border border-[var(--color-border-strong)] bg-surface p-3"
        >
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-foreground">{counts[c.key]}</p>
        </div>
      ))}
    </div>
  );
}

interface ReplyEditorProps {
  feedback: Feedback;
  onSaved: (updated: Feedback) => void;
  onDeleted: () => void;
}

function ReplyEditor({ feedback, onSaved, onDeleted }: ReplyEditorProps) {
  const [reply, setReply] = useState(feedback.adminReply ?? '');
  const [status, setStatus] = useState<FeedbackStatus>(feedback.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await replyFeedback(feedback.id, {
        adminReply: reply.trim() ? reply.trim() : undefined,
        status,
      });
      onSaved(updated);
      notifySuccess('저장되었습니다.');
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장하지 못했습니다.';
      notifyError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    const ok = await confirmAction({
      title: '이 의견을 삭제할까요?',
      text: '삭제하면 되돌릴 수 없습니다.',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteFeedback(feedback.id);
      onDeleted();
      notifySuccess('삭제되었습니다.');
    } catch (err) {
      const message = err instanceof Error ? err.message : '삭제하지 못했습니다.';
      notifyError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--color-border-strong)] pt-4">
      <div className="whitespace-pre-wrap rounded bg-muted p-3 text-sm text-foreground">
        {feedback.content}
      </div>

      {feedback.guestEmail && (
        <p className="text-xs text-muted-foreground">답신용 이메일: {feedback.guestEmail}</p>
      )}

      <Field label="상태" required>
        <div className="flex flex-wrap gap-2">
          {REPLY_STATUS_OPTIONS.map((value) => {
            const active = status === value;
            return (
              <label
                key={value}
                className={
                  'cursor-pointer rounded-md border px-3 py-1.5 text-sm ' +
                  (active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-[var(--color-border-strong)] bg-surface text-surface-foreground hover:bg-muted')
                }
              >
                <input
                  type="radio"
                  name={`status-${feedback.id}`}
                  value={value}
                  checked={active}
                  onChange={() => setStatus(value)}
                  className="sr-only"
                />
                {STATUS_LABEL[value]}
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="답변 (선택)">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full resize-none rounded-md border border-[var(--color-border-strong)] bg-surface p-3 text-sm text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="사용자에게 전달할 답변을 작성해 주세요."
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="md" loading={saving} onClick={handleSave}>
          저장
        </Button>
        <Button type="button" variant="outline" size="md" loading={deleting} onClick={handleDelete}>
          삭제
        </Button>
        {feedback.repliedAt && (
          <span className="ml-auto text-xs text-muted-foreground">
            마지막 응답: {formatDate(feedback.repliedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function authorLabel(f: Feedback): string {
  if (f.userId) return f.userId;
  return f.guestEmail ? `게스트 (${f.guestEmail})` : '게스트';
}
