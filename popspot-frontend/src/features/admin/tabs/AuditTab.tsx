'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, Check, X } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { IpBlockPanel } from '@/features/admin/IpBlockPanel';
import { SecurityOverview } from '@/features/admin/SecurityOverview';

/**
 * 감사 로그 — 관리자가 무엇을 했는지.
 *
 * <p>이 화면 자체는 감사 대상이 아니다. 감사 로그를 볼 때마다 감사 로그가 쌓이면 표가 자기 자신으로 채워진다.
 *
 * <p><b>실패만 보기</b>가 기본 진입점 옆에 있는 이유는, 사고를 의심할 때 가장 먼저 보는 것이 권한 거부와 오류이기 때문이다. 성공한 작업 수천 건 사이에서 그것을
 * 눈으로 찾을 수는 없다.
 */

type AuditRow = {
  id: number;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  success: boolean;
  statusCode: number | null;
  detail: string | null;
  createdAt: string;
};

type PageResponse = { content: AuditRow[]; totalElements: number; totalPages: number };

const PAGE_SIZE = 50;

/** 대상 종류를 사람이 읽는 말로. 코드 상수를 그대로 보여 주면 화면이 로그 덤프가 된다. */
const TARGET_LABEL: Record<string, string> = {
  POPUP: '팝업',
  CHAT: '라이브 댓글',
  MATE_POST: '커뮤니티 글',
  FEEDBACK: '의견',
  ADMIN_SELF: '관리자 계정',
  MEMBER_DATA: '회원 정보',
  SERVER_LOG: '서버 로그',
  SYSTEM: '시스템',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [failedOnly, setFailedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (failedOnly) params.set('failedOnly', 'true');

      const res = await apiFetch(`/api/admin/audit?${params}`);
      if (!res.ok) {
        setError('감사 로그를 불러오지 못했습니다.');
        return;
      }
      const data = (await res.json()) as PageResponse;
      setRows(data.content ?? []);
      setTotal(data.totalElements ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, failedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4 duration-500">
      {/* 목록보다 위에 둔다 — 무엇을 찾을지 모를 때 먼저 보는 화면이다. */}
      <SecurityOverview />

      {/* 현황판 바로 아래다. 이상한 것을 본 다음 할 수 있는 일이 여기 있어야 한다. */}
      <IpBlockPanel />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-lime-500" aria-hidden />
          <h3 className="text-sm font-bold">관리자 행위 기록</h3>
          <span className="text-xs text-muted-foreground">{total.toLocaleString()}건</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFailedOnly((v) => !v);
              setPage(0);
            }}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
              failedOnly
                ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
                : 'border-[var(--color-border)] text-muted-foreground hover:text-foreground'
            }`}
          >
            실패만 보기
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="새로고침"
            className="rounded-xl border border-[var(--color-border)] p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        상태를 바꾸는 작업은 모두, 조회는 개인정보를 대량으로 훑는 것만 남습니다. 요청 내용·토큰·IP·
        이메일은 저장하지 않습니다.
      </p>

      {error && (
        <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-bold">시각</th>
              <th className="px-3 py-2 text-left font-bold">결과</th>
              <th className="px-3 py-2 text-left font-bold">한 일</th>
              <th className="px-3 py-2 text-left font-bold">대상</th>
              <th className="px-3 py-2 text-left font-bold">누가</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)]">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatTime(r.createdAt)}
                </td>
                <td className="px-3 py-2">
                  {r.success ? (
                    <span className="inline-flex items-center gap-1 text-xs text-lime-600 dark:text-lime-400">
                      <Check size={13} aria-hidden /> 성공
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                      <X size={13} aria-hidden /> {r.statusCode ?? '실패'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{r.action}</span>
                  {r.detail && (
                    <span className="ml-2 text-xs text-muted-foreground">{r.detail}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {TARGET_LABEL[r.targetType] ?? r.targetType}
                  {r.targetId && (
                    <span className="ml-1 font-mono text-muted-foreground">#{r.targetId}</span>
                  )}
                </td>
                {/* 계정 식별자는 UUID 라 그대로 다 보여 줄 이유가 없다. 구분에 필요한 앞부분만. */}
                <td
                  className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground"
                  title={r.actorId}
                >
                  {r.actorId.slice(0, 8)}
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {failedOnly ? '실패한 작업이 없습니다.' : '아직 기록이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1 disabled:opacity-30"
          >
            이전
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1 disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
