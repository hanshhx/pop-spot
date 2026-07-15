"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Users } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { getVisitorId } from "@/lib/visitorId";

/**
 * "지금 어때요?" — 원터치 대기 제보.
 *
 * <p>실시간 채팅은 동시 접속자가 있어야 돌지만, 이건 <b>혼자 눌러도 다음 방문자에게 남는</b> 비동기 신호다.
 * 글쓰기가 없어 참여 문턱이 거의 0 이고, 로그인 없이 게스트도 누를 수 있다(익명 visitorId 로 중복만 제한).
 */

type WaitStatus = { level: number | null; count: number; updatedAt: string | null };

const LEVELS = [
  { value: 0, label: "바로 입장", short: "바로 입장 가능", tone: "lime" as const },
  { value: 1, label: "조금 대기", short: "조금 기다려요", tone: "amber" as const },
  { value: 2, label: "많이 대기", short: "많이 기다려요", tone: "rose" as const },
];

const TONE_CLASS: Record<string, { chip: string; btn: string }> = {
  lime: {
    chip: "bg-lime-300/25 text-lime-700 dark:text-lime-300",
    btn: "hover:border-lime-400 hover:bg-lime-300/15",
  },
  amber: {
    chip: "bg-amber-300/25 text-amber-700 dark:text-amber-300",
    btn: "hover:border-amber-400 hover:bg-amber-300/15",
  },
  rose: {
    chip: "bg-rose-300/25 text-rose-700 dark:text-rose-300",
    btn: "hover:border-rose-400 hover:bg-rose-300/15",
  },
};

/** "20분 전" 처럼 상대 시간으로. */
function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  return `${Math.round(min / 60)}시간 전`;
}

export default function NowWait({ popupId }: { popupId: number }) {
  const [status, setStatus] = useState<WaitStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/popups/${popupId}/wait`);
      if (res.status === 204) {
        setStatus(null);
        return;
      }
      if (res.ok) setStatus((await res.json()) as WaitStatus);
    } catch {
      /* 조용히 무시 — 없으면 첫 제보 유도 문구가 뜬다 */
    }
  }, [popupId]);

  useEffect(() => {
    load();
  }, [load]);

  const report = async (level: number) => {
    if (sending) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/popups/${popupId}/wait`, {
        method: "POST",
        body: JSON.stringify({ level, visitorId: getVisitorId() }),
      });
      if (res.ok) {
        setStatus((await res.json()) as WaitStatus);
        setThanks(true);
        setTimeout(() => setThanks(false), 3000);
      }
    } catch {
      /* 실패해도 화면은 유지 */
    } finally {
      setSending(false);
    }
  };

  const current = status && status.level !== null ? LEVELS[status.level] ?? null : null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">지금 어때요?</h2>
        {status && status.count > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users size={13} /> {status.count}명 제보
            {status.updatedAt && (
              <>
                {" · "}
                <Clock size={12} /> {timeAgo(status.updatedAt)}
              </>
            )}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-4">
        {/* 현재 집계 */}
        {current ? (
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded-pill px-3 py-1 text-sm font-black ${TONE_CLASS[current.tone].chip}`}>
              {current.short}
            </span>
            <span className="text-xs text-muted-foreground">최근 3시간 방문자 제보</span>
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">
            아직 제보가 없어요. <b className="text-foreground">첫 제보</b>를 남겨주시면 다음 방문자에게 큰 도움이
            돼요!
          </p>
        )}

        {/* 원터치 버튼 */}
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              disabled={sending}
              onClick={() => report(l.value)}
              className={`rounded-xl border border-[var(--color-border)] bg-cream-100 px-2 py-3 text-xs font-bold text-foreground transition active:scale-95 disabled:opacity-50 dark:bg-ink-800 ${TONE_CLASS[l.tone].btn}`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
          {thanks ? (
            <span className="font-bold text-lime-600 dark:text-lime-300">
              고마워요! 다음 방문자에게 바로 보여요 🙌
            </span>
          ) : (
            "버튼만 누르면 끝 · 로그인 없이도 참여할 수 있어요"
          )}
        </p>
      </div>
    </section>
  );
}
