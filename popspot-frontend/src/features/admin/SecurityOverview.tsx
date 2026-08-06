'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, EyeOff, Trash2, UserCog } from 'lucide-react';

import { apiFetch } from '@/lib/api';

/**
 * D-1 — 감사 로그로 만든 보안 현황판.
 *
 * <p><b>목록과 역할이 다르다.</b> 감사 로그 목록은 <b>무엇을 찾을지 이미 아는</b> 사람이 쓰는
 * 화면이다. 이건 그 반대로, 무엇을 찾아야 할지 모를 때 <b>이상한 것이 눈에 띄게</b> 하는 자리다.
 *
 * <p>답하려는 질문은 넷이다 — 실패가 늘었나 · 낯선 곳에서 접속했나 · 되돌릴 수 없는 일이
 * 있었나 · 개인정보를 꺼냈나.
 */

type Entry = { at: string; actor: string; action: string; target: string; ip: string };
type Overview = {
  days: number;
  total: number;
  failed: number;
  failRate: number;
  byTarget: { target: string; count: number }[];
  newIps: string[];
  knownIpCount: number;
  unknownOrigin: number;
  destructive: Entry[];
  memberDataAccess: Entry[];
};

const RANGES = [
  { days: 1, label: '오늘' },
  { days: 7, label: '일주일' },
  { days: 30, label: '한 달' },
] as const;

export function SecurityOverview() {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    apiFetch(`/api/admin/audit/overview?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((d: Overview) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError('보안 현황을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <section className="mb-4 rounded-2xl border border-[var(--color-border)] bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black">보안 현황</h3>
        <div className="flex overflow-hidden rounded-full border border-[var(--color-border)]">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={`min-h-9 px-3 text-xs font-bold transition-colors ${
                days === r.days
                  ? 'bg-foreground text-[var(--color-surface)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {!data && !error && <p className="text-xs text-muted-foreground">불러오는 중…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cell label="관리자 작업" value={data.total.toLocaleString()} />
            <Cell
              label="실패"
              value={`${data.failed.toLocaleString()} (${data.failRate}%)`}
              /* 실패는 있을 수 있는 일이라 무조건 빨갛게 하지 않는다. 늘 빨간 화면은 아무도 안 본다. */
              tone={data.failed > 0 ? 'warn' : undefined}
            />
            <Cell
              label="처음 보는 접속지"
              value={String(data.newIps.length)}
              hint={`아는 곳 ${data.knownIpCount}`}
              tone={data.newIps.length > 0 ? 'alert' : undefined}
            />
            <Cell label="삭제 작업" value={String(data.destructive.length)} />
          </div>

          {/*
            사각지대를 <b>숫자로</b> 적는다. 이 줄이 없으면 접속지를 못 남긴 작업들은 위 '처음 보는
            접속지' 에서 조용히 빠져, 현황판이 "낯선 곳 없음" 이라고 말하는 것처럼 보인다.
            못 본 것을 못 봤다고 적는 편이 정직하다.
          */}
          {data.unknownOrigin > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <EyeOff size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                이 중 <b>{data.unknownOrigin}건</b>은 접속지를 알 수 없습니다 — 업로드·사진 백필·중복
                정리·로그 스트림은 Vercel 을 거치지 않아 접속자를 증명할 수 없습니다. 위 &ldquo;처음 보는
                접속지&rdquo;는 이 건들을 보지 못합니다.
              </span>
            </p>
          )}

          {data.newIps.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                직전 {data.days}일에는 없던 곳에서 관리자 작업이 있었습니다 —{' '}
                <b>{data.newIps.join(', ')}</b>. 본인이 아니라면 전체 로그아웃을 먼저 하세요.
              </span>
            </p>
          )}

          <EntryList
            icon={<Trash2 size={13} aria-hidden />}
            title="되돌릴 수 없는 작업"
            empty="이 기간에 삭제한 것이 없습니다."
            rows={data.destructive}
          />
          <EntryList
            icon={<UserCog size={13} aria-hidden />}
            title="회원 개인정보 접근"
            empty="이 기간에 회원 정보를 연 적이 없습니다."
            rows={data.memberDataAccess}
          />

          {data.byTarget.length > 0 && (
            <p className="mt-3 border-t border-[var(--color-border)] pt-2.5 text-[11px] text-muted-foreground">
              대상별 — {data.byTarget.map((t) => `${t.target} ${t.count}`).join(' · ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'alert';
}) {
  const color =
    tone === 'alert'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'warn'
        ? 'text-foreground'
        : 'text-foreground';
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EntryList({
  icon,
  title,
  empty,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  rows: Entry[];
}) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
        {icon}
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`} className="px-2.5 py-2 text-[11px]">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="tabular-nums text-muted-foreground">{r.at.slice(5, 16)}</span>
                <span className="font-mono">{r.action}</span>
                {/* IP 는 서버가 이미 가려서 보낸다 — 화면에서 다시 가공하지 않는다. */}
                {r.ip && <span className="ml-auto text-muted-foreground">{r.ip}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
