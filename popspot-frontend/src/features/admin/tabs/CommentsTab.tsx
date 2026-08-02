import { Trash2 } from 'lucide-react';
import type { AdminLiveComment } from '@/features/admin/types';

type CommentsTabProps = {
  comments: AdminLiveComment[];
  selectedComments: Set<number>;
  loadComments: () => void;
  toggleCommentSelect: (id: number) => void;
  toggleSelectAllComments: () => void;
  handleDeleteComment: (id: number) => void;
  handleBulkDeleteComments: () => void;
};

export function CommentsTab({
  comments,
  selectedComments,
  loadComments,
  toggleCommentSelect,
  toggleSelectAllComments,
  handleDeleteComment,
  handleBulkDeleteComments,
}: CommentsTabProps) {
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          실시간 톡방(라이브 댓글) 최근 100건. 개별 또는 일괄 삭제할 수 있어요.
        </p>
        <button
          onClick={loadComments}
          className="shrink-0 rounded-pill border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          새로고침
        </button>
      </div>

      {comments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-cream-100 dark:bg-ink-800/60 px-4 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={comments.length > 0 && selectedComments.size === comments.length}
              onChange={toggleSelectAllComments}
              className="size-4 accent-lime-500"
            />
            전체 선택
            {selectedComments.size > 0 && (
              <span className="text-lime-600 dark:text-lime-300">
                · {selectedComments.size}개 선택됨
              </span>
            )}
          </label>
          <button
            onClick={handleBulkDeleteComments}
            disabled={selectedComments.size === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-bold text-danger transition-all hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} /> 선택 삭제
            {selectedComments.size > 0 ? ` (${selectedComments.size})` : ''}
          </button>
        </div>
      )}

      {comments.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)] text-muted-foreground">
          댓글이 없습니다.
        </div>
      )}
      {comments.map((c) => (
        <div
          key={c.id}
          className={`flex items-center gap-3 rounded-2xl border bg-surface p-4 ${selectedComments.has(c.id) ? 'border-lime-400 ring-1 ring-lime-300/40' : 'border-[var(--color-border)]'}`}
        >
          <input
            type="checkbox"
            checked={selectedComments.has(c.id)}
            onChange={() => toggleCommentSelect(c.id)}
            aria-label="댓글 선택"
            className="size-4 shrink-0 accent-lime-500"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{c.sender}</span>
              {c.popupName && <span className="truncate">· {c.popupName}</span>}
              {c.sendTime && <span>· {new Date(c.sendTime).toLocaleString()}</span>}
            </div>
            <p className="text-sm text-foreground break-all">{c.message}</p>
          </div>
          <button
            onClick={() => handleDeleteComment(c.id)}
            className="shrink-0 px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-muted-foreground hover:border-danger hover:text-danger text-xs font-bold transition-all flex items-center gap-1"
          >
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      ))}
    </div>
  );
}
