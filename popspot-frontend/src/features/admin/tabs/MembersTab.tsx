import { Users } from 'lucide-react';
import type { AdminUser } from '@/features/admin/types';

type MembersTabProps = {
  users: AdminUser[];
};

export function MembersTab({ users }: MembersTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <p className="text-sm font-bold text-muted-foreground mb-4 flex items-center gap-2">
        <Users size={16} className="text-lime-500" /> 회원 {users.length}명
      </p>
      <div className="bg-surface rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-100 dark:bg-ink-800 text-muted-foreground text-left text-xs">
                <th className="px-4 py-3 font-bold">닉네임</th>
                <th className="px-4 py-3 font-bold">이메일</th>
                <th className="px-4 py-3 font-bold">가입경로</th>
                <th className="px-4 py-3 font-bold">등급</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.userId}
                  className="border-t border-[var(--color-border)] hover:bg-foreground/5 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2 font-bold">
                      <span className="w-6 h-6 rounded-full bg-lime-300/30 flex items-center justify-center text-[10px] text-lime-700 dark:text-lime-400 font-black shrink-0">
                        {u.nickname?.[0] ?? '?'}
                      </span>
                      {u.nickname}
                      {u.role === 'ROLE_ADMIN' && (
                        <span className="text-[9px] bg-hot-100 text-hot-500 px-1.5 py-0.5 rounded-full font-bold">
                          ADMIN
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                      {u.provider || 'local'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.isPremium ? (
                      <span className="text-[11px] text-amber-600 font-bold whitespace-nowrap">
                        👑 프리미엄
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">일반</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleString('ko-KR', {
                          year: '2-digit',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    아직 가입한 회원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
