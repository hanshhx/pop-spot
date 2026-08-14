'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { notifySuccess, notifyError } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { PopupReportPayload } from '@/types/popup';

interface ReportPopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 제보 카테고리 — <b>value 는 서버가 받는 코드라 언어와 무관하게 고정</b>이고, 화면에 보이는 이름만
 * 사전 키로 뽑는다. 모듈 최상단이라 훅을 부를 수 없어 문구 대신 키를 담고, 그리는 쪽에서 t() 로 편다.
 */
const CATEGORY_OPTIONS: ReadonlyArray<{ value: string; labelKey: MessageKey }> = [
  { value: 'FASHION', labelKey: 'report.catFashion' },
  { value: 'FOOD', labelKey: 'report.catFood' },
  { value: 'POPUP', labelKey: 'report.catGeneral' },
];

/**
 * 사용자가 발견한 팝업을 제보하는 모달.
 * 새 Dialog 컴포넌트(Radix) 사용 — 포커스 트랩 / ESC / 스크롤 잠금 자동.
 */
export function ReportPopupModal({ open, onOpenChange }: ReportPopupModalProps) {
  const { t } = useLocale();
  const [formData, setFormData] = useState<PopupReportPayload>({
    name: '',
    category: 'FASHION',
    location: '',
    address: '',
    startDate: '',
    endDate: '',
    description: '',
    sourceUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/popups/report', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          name: formData.name.trim(),
          location: formData.location.trim(),
          address: formData.address.trim(),
          description: formData.description.trim(),
          sourceUrl: formData.sourceUrl.trim() || undefined,
        }),
      });
      if (res.ok) {
        await notifySuccess({
          title: t('report.doneTitle'),
          text: t('report.doneText'),
        });
        onOpenChange(false);
      } else {
        notifyError(t('report.failed'));
      }
    } catch {
      notifyError(t('report.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-lime-500" aria-hidden />
            {t('report.title')}
          </DialogTitle>
          <DialogDescription>{t('report.desc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t('report.nameLabel')} required>
            <Input
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder={t('report.namePlaceholder')}
            />
          </Field>

          <Field label={t('report.categoryLabel')} required>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('report.locationLabel')} required>
              <Input
                name="location"
                required
                value={formData.location}
                onChange={handleChange}
                placeholder={t('report.locationPlaceholder')}
              />
            </Field>
            <Field label={t('report.addressLabel')}>
              <Input
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder={t('report.optional')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('report.startDate')} required>
              <Input
                name="startDate"
                type="date"
                required
                value={formData.startDate}
                onChange={handleChange}
              />
            </Field>
            <Field label={t('report.endDate')} required>
              <Input
                name="endDate"
                type="date"
                required
                value={formData.endDate}
                onChange={handleChange}
              />
            </Field>
          </div>

          <Field label={t('report.descLabel')}>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder={t('report.descPlaceholder')}
            />
          </Field>

          <Field label={t('report.sourceUrlLabel')}>
            <Input
              name="sourceUrl"
              type="url"
              value={formData.sourceUrl}
              onChange={handleChange}
              placeholder={t('report.sourceUrlPlaceholder')}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={submitting}
            iconLeft={<Megaphone className="size-4" aria-hidden />}
          >
            {t('report.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
