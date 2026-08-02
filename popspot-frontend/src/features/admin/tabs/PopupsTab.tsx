import type { PopupStore } from '@/types/popup';

type PopupsTabProps = {
  allPopups: PopupStore[];
  isCrawling: boolean;
  isBackfilling: boolean;
  isDeduping: boolean;
  handleRunCrawl: () => void;
  handleBackfillPhotos: () => void;
  handleDedupe: () => void;
  handleChangeStatus: (id: number, currentStatus: string) => void;
};

export function PopupsTab({
  allPopups,
  isCrawling,
  isBackfilling,
  isDeduping,
  handleRunCrawl,
  handleBackfillPhotos,
  handleDedupe,
  handleChangeStatus,
}: PopupsTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          이미지 없는 팝업은 커버 배정으로 각기 다른 사진을 채웁니다.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleRunCrawl}
            disabled={isCrawling}
            title="지금 1회 수집합니다. PC(로컬 AI)가 켜져 있으면 로컬로, 꺼져 있으면 클라우드로 돕니다."
            className="rounded-pill border border-lime-400/60 bg-lime-300/15 px-4 py-2 text-sm font-bold text-lime-700 transition-colors hover:bg-lime-300/25 disabled:opacity-60 dark:text-lime-300"
          >
            {isCrawling ? '수집 중…' : '지금 수집하기'}
          </button>
          <button
            onClick={handleDedupe}
            disabled={isDeduping}
            className="rounded-pill border border-hot-400/60 bg-hot-400/10 px-4 py-2 text-sm font-bold text-hot-500 transition-colors hover:bg-hot-400/20 disabled:opacity-60"
          >
            {isDeduping ? '정리 중…' : '중복 정리'}
          </button>
          <button
            onClick={handleBackfillPhotos}
            disabled={isBackfilling}
            className="rounded-pill bg-lime-300 px-4 py-2 text-sm font-bold text-ink-900 transition-colors hover:bg-lime-400 disabled:opacity-60"
          >
            {isBackfilling ? '배정 중…' : '팝업 사진 채우기'}
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-surface overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-100 dark:bg-ink-800 text-muted-foreground font-bold border-b border-[var(--color-border)] text-[11px]">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">이름</th>
                <th className="p-4">상태</th>
                <th className="p-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {allPopups.map((p) => (
                <tr key={p.id} className="hover:bg-foreground/5 transition-colors">
                  <td className="p-4 text-muted-foreground font-mono">#{p.id}</td>
                  <td className="p-4 font-bold">{p.name}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-lime-300/15 text-lime-600 dark:bg-ink-800 dark:text-lime-300 rounded-full text-[10px] font-bold">
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleChangeStatus(p.id, p.status)}
                      className="px-3 py-1 rounded-lg bg-foreground/5 hover:bg-lime-300 hover:text-ink-900 text-xs font-bold transition-all"
                    >
                      상태 변경
                    </button>
                  </td>
                </tr>
              ))}
              {allPopups.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-16 text-center text-muted-foreground">
                    팝업이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
