import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { notifyError } from '@/lib/notify';

/**
 * 통계를 파일로 내려받는 버튼.
 *
 * <p><b>왜 그냥 링크가 아닌가.</b> 관리자 API 는 {@code Authorization} 헤더로 인증하는데, 브라우저가 링크를 따라갈 때는 그 헤더를 붙이지 않는다.
 * 그래서 직접 요청해 받은 내용을 파일로 만들어 저장시킨다.
 *
 * <p>서버가 잘라서 보낸 경우 헤더로 알려 준다. 조용히 잘리면 "전체를 받았다" 고 믿고 분석해서 틀린 결론에 이른다.
 */

export type ExportDataset = 'visitors' | 'popup-opens' | 'campaigns';

const FORMATS = [
  { key: 'csv', label: 'CSV', hint: '엑셀·구글 시트에서 바로 열림' },
  { key: 'json', label: 'JSON', hint: '다른 도구로 넘길 때' },
] as const;

export function ExportButton({ dataset, days }: { dataset: ExportDataset; days: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const download = async (format: string) => {
    if (busy) return;
    setBusy(format);
    setOpen(false);
    try {
      const res = await apiFetch(`/api/admin/export/${dataset}?days=${days}&format=${format}`);
      if (!res.ok) {
        notifyError({
          title: '내려받지 못했습니다',
          text:
            res.status === 429
              ? '잠시 뒤 다시 시도해 주세요. 내려받기는 시간당 20번까지입니다.'
              : await res.text(),
        });
        return;
      }

      const truncated = res.headers.get('X-Popspot-Truncated');
      const blob = await res.blob();

      // 파일명은 서버가 Content-Disposition 에 담아 준다. 못 읽으면 우리가 만든다.
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^"';]+)"?/i);
      const filename = match?.[1] ?? `popspot-${dataset}-${days}d.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      // 브라우저가 저장을 시작한 뒤에 풀어 준다. 바로 풀면 큰 파일이 중간에 끊긴다.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (truncated) {
        notifyError({
          title: '일부만 내려받았습니다',
          text: `너무 많아 ${Number(truncated).toLocaleString()}줄까지만 담았습니다. 기간을 좁혀 나눠 받으세요.`,
        });
      }
    } catch {
      notifyError({ title: '서버에 연결하지 못했습니다', text: '' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy !== null}
        aria-label="내려받기"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" aria-hidden />
        ) : (
          <Download size={12} aria-hidden />
        )}
        내려받기
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫힌다. 메뉴가 열린 채 남아 다른 버튼을 가리지 않게. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-surface shadow-lg">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => download(f.key)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-foreground/5"
              >
                <span className="text-xs font-bold">{f.label}</span>
                <span className="block text-[11px] text-muted-foreground">{f.hint}</span>
              </button>
            ))}
            <p className="border-t border-[var(--color-border)] px-3 py-2 text-[11px] text-muted-foreground">
              지금 고른 기간({days}일)이 담깁니다. 내려받은 기록은 감사 로그에 남습니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
