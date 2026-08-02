import { Gift } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { RewardForm } from '@/features/admin/types';

type RewardsTabProps = {
  rewardForm: RewardForm;
  setRewardForm: Dispatch<SetStateAction<RewardForm>>;
  handleGiveReward: (e: React.FormEvent) => void;
};

export function RewardsTab({ rewardForm, setRewardForm, handleGiveReward }: RewardsTabProps) {
  return (
    <div className="max-w-md mx-auto bg-surface p-8 rounded-3xl border border-[var(--color-border)] shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-lime-300/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-lime-600 dark:text-lime-300">
          <Gift size={30} />
        </div>
        <h2 className="text-xl font-black">보상 지급</h2>
        <p className="text-xs text-muted-foreground mt-2">
          보상을 지급할 유저의 닉네임을 정확히 입력하세요.
        </p>
      </div>
      <form onSubmit={handleGiveReward} className="space-y-4">
        <input
          type="text"
          value={rewardForm.nickname}
          onChange={(e) => setRewardForm({ ...rewardForm, nickname: e.target.value })}
          placeholder="닉네임 입력"
          className="w-full bg-cream-100 dark:bg-ink-800 border border-[var(--color-border)] rounded-xl p-3 text-sm outline-none focus:border-lime-400 transition-all"
        />
        <select
          value={rewardForm.itemType}
          onChange={(e) => setRewardForm({ ...rewardForm, itemType: e.target.value })}
          className="w-full bg-cream-100 dark:bg-ink-800 border border-[var(--color-border)] rounded-xl p-3 text-sm outline-none"
        >
          <option value="MEGAPHONE">📢 확성기 (MEGAPHONE)</option>
          <option value="POPPASS">👑 팝패스 (POP-PASS)</option>
        </select>
        <input
          type="number"
          min="1"
          value={rewardForm.amount}
          onChange={(e) => setRewardForm({ ...rewardForm, amount: parseInt(e.target.value) })}
          className="w-full bg-cream-100 dark:bg-ink-800 border border-[var(--color-border)] rounded-xl p-3 text-sm outline-none"
        />
        <button
          type="submit"
          className="w-full py-4 bg-lime-300 hover:bg-lime-400 text-ink-900 font-bold rounded-xl shadow-sm transition-all active:scale-95"
        >
          지급하기
        </button>
      </form>
    </div>
  );
}
