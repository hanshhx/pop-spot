import { Check, MapPin, X } from 'lucide-react';
import type { PopupStore } from '@/types/popup';

type PendingTabProps = {
  pendingPopups: PopupStore[];
  handleApprove: (id: number) => void;
  handleReject: (id: number) => void;
};

export function PendingTab({ pendingPopups, handleApprove, handleReject }: PendingTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {pendingPopups.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-[var(--color-border)] text-muted-foreground">
          대기 중인 제보가 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingPopups.map((popup) => (
            <div
              key={popup.id}
              className="rounded-2xl border border-[var(--color-border)] bg-surface p-5 shadow-sm flex flex-col justify-between hover:border-lime-300/60 transition-colors"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold rounded-full">
                    승인 대기
                  </span>
                  <span className="text-xs text-muted-foreground">제보자 {popup.reporterId}</span>
                </div>
                <h3 className="text-lg font-black mb-1.5 truncate">{popup.name}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin size={12} /> {popup.location}
                </p>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                <button
                  onClick={() => handleReject(popup.id)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] font-bold text-sm text-muted-foreground hover:border-danger hover:text-danger transition-colors flex items-center justify-center gap-1"
                >
                  <X size={15} /> 반려
                </button>
                <button
                  onClick={() => handleApprove(popup.id)}
                  className="flex-1 py-2.5 bg-lime-300 text-ink-900 hover:bg-lime-400 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-1"
                >
                  <Check size={15} /> 승인
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
