'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, ShieldOff, Timer } from 'lucide-react';

import { apiFetch } from '@/lib/api';

/**
 * D-2 — IP 임시 차단.
 *
 * <p><b>사람이 걸고 시간이 푼다.</b> 자동으로 걸지 않는 이유는 보안 현황판을 알림이 아니라 현황판으로
 * 만든 것과 같다 — 임계값을 정할 "평소" 가 아직 없고, 차단은 되돌리기 어려운 쪽이다.
 *
 * <p>화면이 "언제까지" 가 아니라 <b>"얼마나 남았는지"</b> 를 보여 주는 것이 중요하다. 그래야 이게
 * 임시라는 것이 드러난다.
 */

type Block = {
  ip: string;
  reason: string;
  blockedBy: string;
  blockedAt: string;
  remainingSeconds: number;
};

const ENDPOINT = '/api/admin/security/ip-blocks';

/** 화면이 제안하는 기간. 서버가 1분~24시간으로 접는다. */
const PRESETS = [
  { minutes: 60, label: '1시간' },
  { minutes: 360, label: '6시간' },
  { minutes: 1440, label: '24시간' },
] as const;

function remainingText(seconds: number): string {
  if (seconds < 60) return `${seconds}초 남음`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 남음`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 남음`;
}

export function IpBlockPanel() {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState<number>(60);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(ENDPOINT);
      if (!res.ok) throw new Error(String(res.status));
      setBlocks(await res.json());
    } catch {
      setBlocks([]);
      setMessage('차단 목록을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const block = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ ip: ip.trim(), reason: reason.trim(), minutes }),
      });
      const data = await res.json();

      // 거절 사유는 서버가 사람 말로 보내 준다. 그냥 "실패" 로 뭉개면 뭘 고쳐야 할지 모른다.
      if (!res.ok) {
        setMessage(data?.message ?? '차단하지 못했습니다.');
        return;
      }
      setMessage(`${data.ip} — ${data.minutes}분 차단했습니다.`);
      setIp('');
      setReason('');
      await load();
    } catch {
      setMessage('차단하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const unblock = async (target: string) => {
    setBusy(true);
    try {
      await apiFetch(`${ENDPOINT}?ip=${encodeURIComponent(target)}`, { method: 'DELETE' });
      setMessage(`${target} 차단을 풀었습니다.`);
      await load();
    } catch {
      setMessage('해제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded-2xl border border-[var(--color-border)] bg-surface p-4">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-black">
        <Ban size={14} aria-hidden />
        IP 임시 차단
      </h3>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        걸어 둔 시간이 지나면 <b>저절로 풀립니다.</b> 공인 IP만 걸 수 있고, 지금 접속 중인 주소는 걸
        수 없습니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="203.0.113.42"
          inputMode="numeric"
          aria-label="차단할 IP"
          /* 16px 미만이면 iOS 가 화면을 통째로 확대한다. */
          className="min-h-11 flex-1 rounded-xl border border-[var(--color-border)] bg-transparent px-3 text-base md:text-sm"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유 (몇 시간 뒤의 내가 읽는다)"
          aria-label="차단 사유"
          className="min-h-11 flex-1 rounded-xl border border-[var(--color-border)] bg-transparent px-3 text-base md:text-sm"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-[var(--color-border)]">
          {PRESETS.map((p) => (
            <button
              key={p.minutes}
              type="button"
              onClick={() => setMinutes(p.minutes)}
              className={`min-h-9 px-3 text-xs font-bold transition-colors ${
                minutes === p.minutes
                  ? 'bg-foreground text-[var(--color-surface)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={block}
          disabled={busy || ip.trim().length === 0}
          className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          차단
        </button>
      </div>

      {message && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{message}</p>}

      <div className="mt-3">
        {blocks === null && <p className="text-[11px] text-muted-foreground">불러오는 중…</p>}
        {blocks?.length === 0 && (
          <p className="text-[11px] text-muted-foreground">지금 차단된 주소가 없습니다.</p>
        )}
        {blocks && blocks.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
            {blocks.map((b) => (
              <li key={b.ip} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2">
                <span className="font-mono text-xs">{b.ip}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Timer size={11} aria-hidden />
                  {remainingText(b.remainingSeconds)}
                </span>
                {b.reason && (
                  <span className="text-[11px] text-muted-foreground">· {b.reason}</span>
                )}
                <button
                  type="button"
                  onClick={() => unblock(b.ip)}
                  disabled={busy}
                  className="ml-auto flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <ShieldOff size={11} aria-hidden />
                  해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
