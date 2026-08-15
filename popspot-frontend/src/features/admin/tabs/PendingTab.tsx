import { CalendarDays, Check, ExternalLink, FileText, Link2, MapPin, X } from 'lucide-react';
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
                  <span className="text-xs text-muted-foreground">
                    {popup.reporterId ? `로그인 제보 · ${popup.reporterId}` : '게스트 제보'}
                  </span>
                </div>
                <h3 className="text-lg font-black mb-3">{popup.name}</h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="flex items-start gap-1.5">
                    <MapPin size={13} className="mt-0.5 shrink-0" />
                    <span>
                      {popup.location || '장소 정보 없음'}
                      {popup.address && <span className="block mt-0.5">{popup.address}</span>}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CalendarDays size={13} className="shrink-0" />
                    {popup.startDate || '시작일 없음'} ~ {popup.endDate || '종료일 없음'}
                  </p>
                  {popup.category && (
                    <p className="flex items-center gap-1.5">
                      <FileText size={13} className="shrink-0" /> 분류 {popup.category}
                    </p>
                  )}
                </div>
                <div className="mt-4 rounded-xl bg-foreground/[0.035] p-3 text-xs leading-5 text-foreground">
                  {popup.description?.trim() || '제보 설명이 없습니다.'}
                </div>
                <div className="mt-3">
                  {isSafeHttpUrl(popup.sourceUrl) ? (
                    <a
                      href={popup.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-lime-700 underline underline-offset-2 dark:text-lime-300"
                    >
                      <Link2 size={13} /> 근거 링크 확인 <ExternalLink size={12} />
                    </a>
                  ) : (
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      근거 링크 없음 · 승인 전 다른 출처로 사실 확인 필요
                    </p>
                  )}
                </div>
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

function isSafeHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
