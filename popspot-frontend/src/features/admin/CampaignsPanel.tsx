'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, RefreshCw } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { ExportButton } from '@/features/admin/ExportButton';

/**
 * 유입 캠페인 — 어떤 홍보가 사람을 데려왔나.
 *
 * <p>유입 출처(naver.com, instagram.com)와 다르다. 출처는 "어느 사이트에서 왔나" 만 알려 주는데,
 * 같은 인스타그램이라도 프로필 링크로 온 것과 특정 게시물 광고로 온 것은 전혀 다른 이야기다.
 *
 * <p>방문 횟수가 아니라 <b>사람 수</b>로 센다. 캠페인이 데려온 것은 사람이지 클릭이 아니다.
 */

type Campaign = {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
};

const RANGES = [
  { days: 30, label: '한 달' },
  { days: 90, label: '3개월' },
] as const;

export function CampaignsPanel() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/visits/campaigns?days=${days}`);
      // 실패는 실패라고 말한다. 삼키면 "아직 캠페인 유입이 없어요" 가 떠서,
      // 고장난 화면과 홍보가 안 먹힌 화면이 똑같아 보인다.
      if (!res.ok) {
        setError('통계를 불러오지 못했습니다.');
        return;
      }
      setRows((await res.json()) as Campaign[]);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Megaphone size={16} className="text-lime-500" aria-hidden /> 유입 캠페인
        </h3>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-[var(--color-border)]">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={`px-3 py-1 text-xs font-bold transition-colors ${
                  days === r.days
                    ? 'bg-foreground text-[var(--color-surface)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <ExportButton dataset="campaigns" days={days} />

          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="새로고침"
            className="rounded-full border border-[var(--color-border)] p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-500/10 p-3 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {loading ? (
            '불러오는 중…'
          ) : (
            <>
              아직 캠페인 유입이 없어요.
              <span className="mt-2 block text-xs">
                홍보 링크 뒤에 <code>?utm_source=instagram&amp;utm_medium=post</code> 처럼 붙여
                올리면 여기 집계됩니다.
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 text-left font-bold">어디서</th>
                <th className="py-2 text-left font-bold">방식</th>
                <th className="py-2 text-left font-bold">캠페인</th>
                <th className="py-2 text-right font-bold">데려온 사람</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.source}|${r.medium}|${r.campaign}|${i}`}
                  className="border-t border-[var(--color-border)]"
                >
                  <td className="py-2 font-bold">{r.source}</td>
                  <td className="py-2 text-muted-foreground">{r.medium || '-'}</td>
                  <td className="py-2 text-muted-foreground">{r.campaign || '-'}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{r.visitors}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
