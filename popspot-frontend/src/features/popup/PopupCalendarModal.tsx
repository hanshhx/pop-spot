'use client';

import { Calendar as CalendarIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLocale } from '@/lib/i18n';
import type { PopupStore } from '@/types/popup';

import { PopupCalendar } from './PopupCalendar';

interface PopupCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popups: PopupStore[];
}

/**
 * 월별 팝업 일정 캘린더 모달 — 껍데기만.
 *
 * <p>달력 자체는 {@link PopupCalendar} 에 있다. 하단 메뉴의 '일정' 이 같은 달력을 화면으로
 * 열기 때문에, 두 곳이 같은 컴포넌트를 보게 해 두 벌로 갈라지지 않게 한다.
 */
export function PopupCalendarModal({ open, onOpenChange, popups }: PopupCalendarModalProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5 text-lime-500" aria-hidden />
            {t('pmodal.cal.title')}
          </DialogTitle>
          <DialogDescription>{t('pmodal.cal.desc')}</DialogDescription>
        </DialogHeader>

        <PopupCalendar popups={popups} onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
