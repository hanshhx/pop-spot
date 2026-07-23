'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';

import { apiFetch } from '@/lib/api';
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
import type { User, PopupReportPayload } from '@/types/popup';

interface ReportPopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

const CATEGORY_OPTIONS = [
  { value: 'FASHION', label: '패션' },
  { value: 'FOOD', label: '음식' },
  { value: 'POPUP', label: '일반' },
];

/**
 * 사용자가 발견한 팝업을 제보하는 모달.
 * 새 Dialog 컴포넌트(Radix) 사용 — 포커스 트랩 / ESC / 스크롤 잠금 자동.
 */
export function ReportPopupModal({ open, onOpenChange, user }: ReportPopupModalProps) {
  const [formData, setFormData] = useState<PopupReportPayload>({
    name: '',
    category: 'FASHION',
    location: '',
    address: '',
    startDate: '',
    endDate: '',
    description: '',
    reporterId: user?.userId || 'unknown',
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
          reporterId: user?.userId || 'unknown',
        }),
      });
      if (res.ok) {
        await notifySuccess({
          title: '제보 완료',
          text: '관리자 승인 후 지도에 노출됩니다.',
        });
        onOpenChange(false);
      } else {
        notifyError('제보를 처리하지 못했습니다.');
      }
    } catch {
      notifyError('서버와 연결할 수 없습니다.');
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
            팝업 제보
          </DialogTitle>
          <DialogDescription>
            알고 있는 팝업 정보를 공유해주세요. 관리자 검토 후 지도에 노출됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="팝업 이름" required>
            <Input
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="예: 젠틀몬스터 하우스도산"
            />
          </Field>

          <Field label="카테고리" required>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="지역" required>
              <Input
                name="location"
                required
                value={formData.location}
                onChange={handleChange}
                placeholder="성수동"
              />
            </Field>
            <Field label="주소">
              <Input
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="(선택)"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일" required>
              <Input
                name="startDate"
                type="date"
                required
                value={formData.startDate}
                onChange={handleChange}
              />
            </Field>
            <Field label="종료일" required>
              <Input
                name="endDate"
                type="date"
                required
                value={formData.endDate}
                onChange={handleChange}
              />
            </Field>
          </div>

          <Field label="간단 설명">
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="팝업의 컨셉이나 특징을 알려주세요."
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
            제보 제출
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
