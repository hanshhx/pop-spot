'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

/**
 * C-3 — 세션 기준 요약. 방문자 목록 위에 얹는 한 줄이다.
 *
 * <p><b>왜 이 화면이 필요한가.</b> 그동안 관리자 화면이 답하지 못한 질문이 "온 사람이 <b>다시</b>
 * 오나" 였다. 수집은 이미 되고 있었는데({@code visit_event.session_id}) 읽는 API 가 없어서,
 * 방문자 CSV 를 받아도 재방문율을 계산할 수 없었다. 유입만 늘리고 남는지는 모르는 상태였다.
 *
 * <p>기간은 부모(방문자 목록)가 고른 것을 그대로 쓴다. 여기에 따로 두면 표와 요약이 서로 다른
 * 기간을 보여 주면서 <b>같은 화면에서 숫자가 안 맞는</b> 상태가 된다.
 */

type SessionStats = {
  sessions: number;
  visitors: number;
  events: number;
  returningVisitors: number;
  newVisitors: number;
  returnRate: number;
  eventsPerSession: number;
  sessionsPerVisitor: number;
  retentionDays: number;
  truncated: boolean;
};

export function SessionSummary({ days }: { days: number }) {
  const [data, setData] = useState<SessionStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    apiFetch(`/api/admin/visits/sessions?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((d: SessionStats) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        // 요약 하나 때문에 방문자 목록까지 못 보게 만들지 않는다. 조용히 자리를 비운다.
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error || !data) return null;

  return (
    <section className="mb-4 rounded-2xl border border-[var(--color-border)] bg-surface p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Cell label="세션" value={data.sessions.toLocaleString()} />
        <Cell label="방문자" value={data.visitors.toLocaleString()} />
        <Cell
          label="재방문율"
          value={`${data.returnRate}%`}
          hint={`재방문 ${data.returningVisitors.toLocaleString()} · 신규 ${data.newVisitors.toLocaleString()}`}
          strong
        />
        <Cell label="세션당 행동" value={String(data.eventsPerSession)} />
        <Cell label="방문자당 세션" value={String(data.sessionsPerVisitor)} />
      </div>

      {/*
        보관기간을 넘겨 물으면 앞쪽 구간에는 비교할 과거가 없어 그 사람들이 전부 신규로 잡힌다.
        이 사실을 적어 두지 않으면 화면은 멀쩡한데 숫자만 낮게 나오고, 보는 사람은 알 방법이 없다.
      */}
      {data.truncated && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          기록을 {data.retentionDays}일만 보관하므로, 이 기간의 앞쪽은 비교할 과거가 없어 신규로
          잡힙니다. <b>실제 재방문율은 이보다 높습니다.</b>
        </p>
      )}
    </section>
  );
}

function Cell({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${
          strong ? 'text-xl font-black text-lime-600 dark:text-lime-300' : 'text-lg font-bold'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
