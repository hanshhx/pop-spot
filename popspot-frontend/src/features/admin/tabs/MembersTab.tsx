'use client';

import { useState } from 'react';
import { Users, Eye } from 'lucide-react';
import type { AdminUser } from '@/features/admin/types';

import { apiFetch } from '@/lib/api';
import { notifyError } from '@/lib/notify';

type MembersTabProps = {
  users: AdminUser[];
};

export function MembersTab({ users }: MembersTabProps) {
  /**
   * 해제해서 받아 온 전체 주소. 화면을 벗어나면 사라진다 — 어디에도 저장하지 않는다.
   *
   * <p>해제는 한 건씩이고 서버에 감사 기록이 남는다. 그래서 "일단 다 열어 두고 보기" 가 안 되고,
   * 정말 필요한 건만 열게 된다. 그게 이 버튼의 목적이다.
   */
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const reveal = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    try {
      const res = await apiFetch(`/api/admin/reveal/users/${userId}/email`, { method: 'POST' });
      if (!res.ok) {
        notifyError({
          title: '주소를 열지 못했습니다',
          text:
            res.status === 429
              ? '너무 자주 열었습니다. 잠시 뒤 다시 시도해 주세요.'
              : await res.text(),
        });
        return;
      }
      const data = (await res.json()) as { email: string };
      setRevealed((prev) => ({ ...prev, [userId]: data.email }));
    } catch {
      notifyError({ title: '서버에 연결하지 못했습니다', text: '' });
    } finally {
      setBusy(null);
    }
  };

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
                  <td className="px-4 py-3 text-muted-foreground">
                    {revealed[u.userId] ? (
                      <span className="font-mono text-xs">{revealed[u.userId]}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-xs">{u.emailMasked ?? '-'}</span>
                        <button
                          type="button"
                          onClick={() => reveal(u.userId)}
                          disabled={busy === u.userId}
                          title="전체 주소 보기 (기록에 남습니다)"
                          aria-label="전체 주소 보기"
                          className="shrink-0 rounded p-0.5 transition-colors hover:text-foreground disabled:opacity-40"
                        >
                          <Eye size={13} aria-hidden />
                        </button>
                      </span>
                    )}
                  </td>
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
