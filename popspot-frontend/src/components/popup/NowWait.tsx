'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Users } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { getVisitorId } from '@/lib/visitorId';
import { useLocale, type Locale } from '@/lib/i18n';

/**
 * "지금 어때요?" — 원터치 대기 제보.
 *
 * <p>실시간 채팅은 동시 접속자가 있어야 돌지만, 이건 <b>혼자 눌러도 다음 방문자에게 남는</b> 비동기 신호다.
 * 글쓰기가 없어 참여 문턱이 거의 0 이고, 로그인 없이 게스트도 누를 수 있다(익명 visitorId 로 중복만 제한).
 */

type WaitStatus = { level: number | null; count: number; updatedAt: string | null };

const LEVELS = [
  { value: 0, tone: 'lime' as const },
  { value: 1, tone: 'amber' as const },
  { value: 2, tone: 'rose' as const },
];

const COPY = {
  ko: {
    title: '지금 어때요?',
    reports: (n: number) => `${n}명 제보`,
    now: '방금',
    minutes: (n: number) => `${n}분 전`,
    hours: (n: number) => `${n}시간 전`,
    recent: '최근 3시간 방문자 제보',
    empty: '아직 제보가 없어요.',
    first: '첫 제보',
    emptyTail: '를 남겨주시면 다음 방문자에게 큰 도움이 돼요!',
    thanks: '고마워요! 다음 방문자에게 바로 보여요 🙌',
    failed: '제보를 보내지 못했어요. 잠시 후 다시 눌러 주세요.',
    prompt: '버튼만 누르면 끝 · 로그인 없이도 참여할 수 있어요',
    levels: [
      ['바로 입장', '바로 입장 가능'],
      ['조금 대기', '조금 기다려요'],
      ['많이 대기', '많이 기다려요'],
    ],
  },
  en: {
    title: 'What is it like now?',
    reports: (n: number) => `${n} ${n === 1 ? 'report' : 'reports'}`,
    now: 'Just now',
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} hr ago`,
    recent: 'Reports from the last 3 hours',
    empty: 'No reports yet.',
    first: 'Be the first',
    emptyTail: ' to help the next visitor.',
    thanks: 'Thank you! The next visitor can see it now 🙌',
    failed: 'Could not send your report. Please try again in a moment.',
    prompt: 'One tap · no login required',
    levels: [
      ['Walk right in', 'No wait'],
      ['Short wait', 'A short wait'],
      ['Long wait', 'A long wait'],
    ],
  },
  ja: {
    title: '今の待ち時間は？',
    reports: (n: number) => `${n}件の報告`,
    now: 'たった今',
    minutes: (n: number) => `${n}分前`,
    hours: (n: number) => `${n}時間前`,
    recent: '直近3時間の訪問者情報',
    empty: 'まだ報告がありません。',
    first: '最初の報告',
    emptyTail: 'を残すと、次の訪問者の助けになります。',
    thanks: 'ありがとうございます！次の訪問者にすぐ表示されます 🙌',
    failed: '報告を送信できませんでした。少し後にもう一度お試しください。',
    prompt: 'ボタンを押すだけ・ログイン不要',
    levels: [
      ['すぐ入れる', '待ち時間なし'],
      ['少し待つ', '少し待ちます'],
      ['かなり待つ', 'かなり待ちます'],
    ],
  },
} as const;

const TONE_CLASS: Record<string, { chip: string; btn: string }> = {
  lime: {
    chip: 'bg-lime-300/25 text-lime-700 dark:text-lime-300',
    btn: 'hover:border-lime-400 hover:bg-lime-300/15',
  },
  amber: {
    chip: 'bg-amber-300/25 text-amber-700 dark:text-amber-300',
    btn: 'hover:border-amber-400 hover:bg-amber-300/15',
  },
  rose: {
    chip: 'bg-rose-300/25 text-rose-700 dark:text-rose-300',
    btn: 'hover:border-rose-400 hover:bg-rose-300/15',
  },
};

/** "20분 전" 처럼 상대 시간으로. */
function timeAgo(iso: string | null, locale: Locale): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  const copy = COPY[locale];
  if (min < 1) return copy.now;
  if (min < 60) return copy.minutes(min);
  return copy.hours(Math.round(min / 60));
}

export default function NowWait({ popupId }: { popupId: number }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [status, setStatus] = useState<WaitStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [failed, setFailed] = useState(false);

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
    setFailed(false);
    try {
      const res = await apiFetch(`/api/popups/${popupId}/wait`, {
        method: 'POST',
        body: JSON.stringify({ level, visitorId: getVisitorId() }),
      });
      // 버튼을 눌렀는데 아무 일도 안 일어나는 것이 가장 나쁘다. 누른 사람은 자기가
      // 잘못 눌렀다고 생각하고 다시 누르거나, 보냈다고 믿고 떠난다.
      if (!res.ok) {
        setFailed(true);
        setTimeout(() => setFailed(false), 4000);
        return;
      }
      setStatus((await res.json()) as WaitStatus);
      setThanks(true);
      setTimeout(() => setThanks(false), 3000);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 4000);
    } finally {
      setSending(false);
    }
  };

  const current = status && status.level !== null ? (LEVELS[status.level] ?? null) : null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">{copy.title}</h2>
        {status && status.count > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users size={13} /> {copy.reports(status.count)}
            {status.updatedAt && (
              <>
                {' · '}
                <Clock size={12} /> {timeAgo(status.updatedAt, locale)}
              </>
            )}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-surface p-4">
        {/* 현재 집계 */}
        {current ? (
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`rounded-pill px-3 py-1 text-sm font-black ${TONE_CLASS[current.tone].chip}`}
            >
              {copy.levels[current.value][1]}
            </span>
            <span className="text-xs text-muted-foreground">{copy.recent}</span>
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">
            {copy.empty} <b className="text-foreground">{copy.first}</b>
            {copy.emptyTail}
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
              {copy.levels[l.value][0]}
            </button>
          ))}
        </div>

        <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
          {thanks ? (
            <span className="font-bold text-lime-600 dark:text-lime-300">{copy.thanks}</span>
          ) : failed ? (
            <span className="font-bold text-red-600 dark:text-red-400">{copy.failed}</span>
          ) : (
            copy.prompt
          )}
        </p>
      </div>
    </section>
  );
}
