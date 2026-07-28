'use client';

import { Award, ChevronRight, Stamp } from 'lucide-react';
import { getUserRank, nextRankLabels } from '@/lib/rank';
import { localizedLabel, useLocale, type MessageKey } from '@/lib/i18n';

interface Props {
  stampCount: number;
  nickname?: string;
  onSeeAll?: () => void;
}

/**
 * 현재 등급과 다음 등급까지 진행도를 한눈에 보여주는 카드.
 * MY 탭의 POP-PASS 자리에 들어가서 사용자의 활동을 자랑/동기부여한다.
 */
export default function RankCard({ stampCount, nickname, onSeeAll }: Props) {
  const { t, locale } = useLocale();
  const rank = getUserRank(stampCount);

  // 다음 등급까지 진행도 (현재 단계 안에서의 비율)
  let progress = 0;
  if (rank.key === 'MASTER') progress = 100;
  else if (rank.key === 'HUNTER') progress = ((stampCount - 6) / 6) * 100;
  else if (rank.key === 'BEGINNER') progress = ((stampCount - 3) / 3) * 100;
  else progress = (stampCount / 3) * 100;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br ${rank.bg} p-5 lg:p-6`}
    >
      {/* 우측 상단 장식 */}
      <Award className="absolute -right-3 -top-3 h-24 w-24 opacity-10" strokeWidth={1.2} />

      <div className="relative flex items-center gap-3 lg:gap-4">
        <div
          className={`grid h-12 w-12 lg:h-14 lg:w-14 place-items-center rounded-2xl bg-surface shadow-md ring-4 ${rank.ring}`}
        >
          <Stamp className={`h-5 w-5 lg:h-6 lg:w-6 ${rank.text}`} strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {/* 닉네임은 사용자가 지은 이름이라 번역 대상이 아니다. 붙는 말만 언어에 맞춘다. */}
            {nickname ? `${nickname}${t('rank.ownerSuffix')}` : t('rank.myRank')}
          </p>
          <h4 className={`mt-0.5 text-lg lg:text-xl font-black tracking-tight ${rank.text}`}>
            {localizedLabel(rank, locale)}
          </h4>
        </div>

        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="grid h-9 w-9 place-items-center rounded-full bg-foreground/5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
            aria-label={t('rank.passportAria')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 다음 등급까지 진행도 */}
      <div className="relative mt-5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
          {/* 숫자를 사이에 끼우는 문장은 앞뒤 조각으로 나눈다 — 띄어쓰기는 사전 값이 들고 있다. */}
          <span>
            {t('rank.stampsPrefix')}
            <strong className="text-foreground">{stampCount}</strong>
            {t('rank.stampsSuffix')}
          </span>
          {rank.key === 'MASTER' ? (
            <span className="text-amber-500 dark:text-amber-300">{t('rank.maxReached')}</span>
          ) : (
            <span>
              <strong className="text-foreground">
                {localizedLabel(nextRankLabels(rank), locale)}
              </strong>
              {t('rank.toNextMid')}
              {rank.toNext}
              {t('rank.toNextSuffix')}
            </span>
          )}
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={`h-full ${rank.accent} transition-all duration-500`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      {/* 획득한 뱃지 미니 진열 */}
      <div className="relative mt-5 flex items-center gap-2">
        <BadgePill labelKey="rank.badgeBeginner" achieved={stampCount >= 3} />
        <BadgePill labelKey="rank.badgeHunter" achieved={stampCount >= 6} />
        <BadgePill labelKey="rank.badgeMaster" achieved={stampCount >= 12} />
      </div>
    </div>
  );
}

function BadgePill({ labelKey, achieved }: { labelKey: MessageKey; achieved: boolean }) {
  const { t } = useLocale();
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
        achieved
          ? 'bg-foreground text-background'
          : 'bg-foreground/5 text-muted-foreground border border-[var(--color-border)]'
      }`}
    >
      {t(labelKey)}
    </span>
  );
}
