'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHistoryBackedModal } from '@/features/popup/useHistoryBackedModal';
import { bilingual } from '@/lib/bilingual';
import { buildCompareView, type CompareCell, type CompareRowKind } from '@/lib/compareRows';
import type { CompareItem } from '@/lib/compareRows';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { savedBadgeText, savedBadgeTone } from '@/lib/savedBadgeText';
import { cn } from '@/lib/utils';

/**
 * 담아 둔 것 중 고른 셋을 <b>나란히</b> 놓고 본다.
 *
 * <p><b>세 칸만 그린다.</b> 기획(§4.3)은 다섯을 적었지만 입장 조건과 비용은 담을 그릇이 없다 —
 * 자세한 근거는 {@code compareRows.ts} 와 개발계획에 있다. 빈 칸을 그려 두고 "정보 없음" 을
 * 적으면 우리가 모른다는 사실을 카드마다 반복해 보여 주는 화면이 된다.
 *
 * <p><b>모바일은 표가 아니라 카드다.</b> 320px 에서 3열 표는 한 칸이 100px 남짓이라 위치도 기간도
 * 잘린다. 그래서 좁은 화면에서는 팝업 하나가 카드 하나가 되고 그 안에 세 줄이 들어간다. 넓은
 * 화면에서만 나란히 세운다. 같은 내용이 두 번 그려지지만, 잘린 표를 보여 주는 것보다 낫다.
 *
 * <p><b>순서는 마감이 급한 것부터</b>({@link buildCompareView}). 후보를 고르는 마이팝 목록이 이미
 * 그 순서라, 비교만 고른 순서를 쓰면 같은 데이터가 두 화면에서 다르게 보인다.
 *
 * <p><b>뒤로가기</b>는 {@link useHistoryBackedModal} 에 맡긴다. 카드를 눌러 상세로 가는 것은
 * "닫는 것" 이 아니라 "떠나는 것" 이라 {@code notifyNavigatingAway()} 를 먼저 부른다 —
 * {@code AllTrendingModal} 이 같은 규칙을 쓴다.
 */

interface CompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 고른 것. 정렬은 이 안에서 한다 — 호출부가 순서를 맞출 필요가 없다. */
  items: CompareItem[];
  /** 비교에서 뺀다. 찜은 건드리지 않는다. */
  onRemove: (popupId: number) => void;
}

const ROW_LABEL: Record<CompareRowKind, MessageKey> = {
  location: 'compare.rowLocation',
  period: 'compare.rowPeriod',
  summary: 'compare.rowSummary',
};

/** 한 칸의 속. 표와 카드가 <b>같은 것</b>을 그리도록 한 곳에 둔다. */
function CellBody({ cell, t }: { cell: CompareCell | null; t: (k: MessageKey) => string }) {
  // 값이 없으면 '정보 없음' 을 적지 않는다. 셋 다 없으면 행 자체가 오지 않고(compareRows),
  // 하나만 없으면 그 자리를 비운다 — 없다는 말을 굳이 글자로 채우지 않는다.
  if (!cell)
    return (
      <span aria-hidden className="text-muted-foreground/40">
        —
      </span>
    );

  return (
    <div className="space-y-1">
      {cell.badge && (
        <span
          className={cn(
            'inline-block rounded-pill px-2 py-0.5 text-[11px] font-bold',
            savedBadgeTone(cell.badge),
          )}
        >
          {savedBadgeText(cell.badge, t)}
        </span>
      )}
      <p className="break-keep text-sm leading-snug">{cell.text}</p>
      {cell.sub && <p className="break-keep text-xs text-muted-foreground">{cell.sub}</p>}
    </div>
  );
}

export function CompareModal({ open, onOpenChange, items, onRemove }: CompareModalProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const { onOpenChange: handleOpenChange, notifyNavigatingAway } = useHistoryBackedModal(
    open,
    onOpenChange,
  );

  const { items: ordered, rows } = buildCompareView(items);

  const goDetail = (popupId: number) => {
    // 닫는 게 아니라 떠나는 것 — history 항목을 back() 으로 소비하지 않는다.
    notifyNavigatingAway();
    onOpenChange(false);
    router.replace(localizedPath(`/popup/${popupId}`, locale));
  };

  const titleOf = (item: CompareItem) => bilingual(item.name, item.nameTranslated);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black md:text-2xl">{t('compare.title')}</DialogTitle>
          {ordered.length < 2 && <DialogDescription>{t('compare.needMore')}</DialogDescription>}
        </DialogHeader>

        <div className="custom-scrollbar -mx-1 overflow-y-auto px-1 pb-2">
          {/* 좁은 화면 — 팝업 하나가 카드 하나. 3열 표는 320px 에서 글자가 잘린다. */}
          <div className="space-y-3 md:hidden">
            {ordered.map((item, col) => {
              const title = titleOf(item);
              return (
                <div
                  key={item.popupId}
                  className="rounded-2xl border border-[var(--color-border)] bg-surface p-3"
                >
                  <div className="mb-2 flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => goDetail(item.popupId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-bold">{title.display}</p>
                      {title.original && (
                        <p className="truncate text-xs text-muted-foreground">{title.original}</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.popupId)}
                      aria-label={t('compare.remove')}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-cream-200 dark:hover:bg-ink-800"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <dl className="space-y-2">
                    {rows.map((row) => (
                      <div key={row.kind} className="flex gap-3">
                        <dt className="w-16 shrink-0 pt-0.5 text-xs font-bold text-muted-foreground">
                          {t(ROW_LABEL[row.kind])}
                        </dt>
                        <dd className="min-w-0 flex-1">
                          <CellBody cell={row.cells[col]} t={t} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>

          {/* 넓은 화면 — 나란히. 열 수는 고른 개수만큼만 만든다. */}
          <div className="hidden md:block">
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `4.5rem repeat(${ordered.length}, minmax(0, 1fr))` }}
            >
              <div aria-hidden />
              {ordered.map((item) => {
                const title = titleOf(item);
                return (
                  <div key={item.popupId} className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => goDetail(item.popupId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="break-keep font-bold leading-snug">{title.display}</p>
                      {title.original && (
                        <p className="truncate text-xs text-muted-foreground">{title.original}</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.popupId)}
                      aria-label={t('compare.remove')}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-cream-200 dark:hover:bg-ink-800"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                );
              })}

              {rows.map((row) => (
                <div key={row.kind} className="contents">
                  <div className="border-t border-[var(--color-border)] pt-3 text-xs font-bold text-muted-foreground">
                    {t(ROW_LABEL[row.kind])}
                  </div>
                  {row.cells.map((cell, i) => (
                    <div
                      key={ordered[i].popupId}
                      className="border-t border-[var(--color-border)] pt-3"
                    >
                      <CellBody cell={cell} t={t} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
