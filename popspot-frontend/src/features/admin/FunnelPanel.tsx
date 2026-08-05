'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

/**
 * C-4 퍼널 — 들어온 사람이 어디까지 가고 <b>어디서 멈추나.</b>
 *
 * <p>막대 길이는 첫 칸(방문) 대비다. 그런데 정작 봐야 할 숫자는 <b>앞 칸 대비</b>다 — 방문 대비
 * 1% 라는 사실보다 "상세를 연 사람 중 20%만 찜했다" 가 무엇을 고쳐야 할지 알려 준다. 그래서 앞 칸
 * 대비를 크게, 첫 칸 대비를 작게 둔다.
 */

type Step = {
  key: string;
  label: string;
  visitors: number;
  ofFirst: number;
  ofPrev: number;
  collectedSince: string;
};

type Funnel = { steps: Step[]; since: string; note: string };

export function FunnelPanel({ days }: { days: number }) {
  const [data, setData] = useState<Funnel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    apiFetch(`/api/admin/visits/funnel?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((d: Funnel) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        // 퍼널 하나 때문에 방문자 탭 전체를 못 보게 만들지 않는다.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (failed || !data || data.steps.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl border border-[var(--color-border)] bg-surface p-4">
      <h3 className="mb-3 text-sm font-black">어디서 멈추나</h3>

      <ol className="space-y-2.5">
        {data.steps.map((s, i) => (
          <li key={s.key}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-bold">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.visitors.toLocaleString()}명{/* 첫 칸은 자기 자신과의 비교라 뜻이 없다. */}
                {i > 0 && (
                  <>
                    {' · '}
                    <b className="text-foreground">앞 칸의 {s.ofPrev}%</b>
                    {' · 방문의 '}
                    {s.ofFirst}%
                  </>
                )}
              </span>
            </div>

            {/* 막대는 첫 칸 대비. 100%를 넘는 값도 있을 수 있어 폭을 100%에서 자른다 —
                숫자는 그대로 두되 막대가 칸을 뚫고 나가지는 않게. */}
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-lime-400"
                style={{ width: `${Math.min(s.ofFirst, 100)}%` }}
              />
            </div>

            {s.collectedSince && (
              <p className="mt-1 text-[10px] text-muted-foreground">{s.collectedSince}부터 수집</p>
            )}
          </li>
        ))}
      </ol>

      {data.note && (
        <p className="mt-3 border-t border-[var(--color-border)] pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {data.note}
        </p>
      )}
    </section>
  );
}
