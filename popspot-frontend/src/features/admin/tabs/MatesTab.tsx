import { Trash2 } from 'lucide-react';
import type { AdminMatePost } from '@/features/admin/types';

type MatesTabProps = {
  matePosts: AdminMatePost[];
  handleDeleteMatePost: (id: number) => void;
};

export function MatesTab({ matePosts, handleDeleteMatePost }: MatesTabProps) {
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {matePosts.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)] text-muted-foreground">
          게시글이 없습니다.
        </div>
      )}
      {matePosts.map((post) => (
        <div
          key={post.id}
          className="bg-surface p-5 rounded-2xl border border-[var(--color-border)] flex justify-between items-center gap-3 group"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {post.isMegaphone && (
                <span className="text-[10px] bg-hot-100 text-hot-500 px-2 py-0.5 rounded-full font-bold">
                  부스트
                </span>
              )}
              <h3 className="font-bold text-base truncate">{post.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground truncate">{post.content}</p>
          </div>
          <button
            onClick={() => handleDeleteMatePost(post.id)}
            className="shrink-0 px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-muted-foreground hover:border-danger hover:text-danger text-xs font-bold transition-all flex items-center gap-1"
          >
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      ))}
    </div>
  );
}
