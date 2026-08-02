'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
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

interface TakedownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popupId: number;
  popupName?: string;
}

const REASON_OPTIONS = ['COPYRIGHT', 'INACCURATE', 'OWNER_REQUEST', 'OTHER'] as const;
const CANONICAL_REASON: Record<(typeof REASON_OPTIONS)[number], string> = {
  COPYRIGHT: '저작권 침해 (이미지/문구 무단 사용)',
  INACCURATE: '정보가 부정확함 (날짜/장소 등)',
  OWNER_REQUEST: '본인이 운영하는 팝업이며 동의 없이 게시됨',
  OTHER: '기타',
};

const COPY = {
  ko: {
    title: '정보 삭제·수정 요청',
    description:
      '이 정보가 부정확하거나 저작권을 침해한다면 알려주세요. 접수된 정보는 즉시 숨겨지며 24시간 안에 검토합니다.',
    policy: '이용약관 §11 권리자 정보 삭제 요청 절차',
    target: '대상 팝업',
    email: '신고자 이메일 (회신용)',
    reason: '신고 사유',
    detail: '상세 내용',
    placeholder: '구체적인 사유 / 정정 정보 / 권리 증빙 정보 등',
    warning: '허위·악성 신고로 정상 콘텐츠의 노출을 방해하면 손해배상 책임이 발생할 수 있습니다.',
    submit: '신고 제출',
    successTitle: '신고가 접수되었습니다',
    successText: '24시간 안에 검토합니다. 해당 정보는 즉시 숨겨집니다.',
    failed: '신고 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
    network: '서버와 연결할 수 없습니다.',
    reasons: [
      '저작권 침해 (이미지/문구 무단 사용)',
      '정보가 부정확함 (날짜/장소 등)',
      '본인이 운영하는 팝업이며 동의 없이 게시됨',
      '기타',
    ],
  },
  en: {
    title: 'Request a correction or removal',
    description:
      'Tell us if this listing is inaccurate or infringes your rights. It will be hidden immediately and reviewed within 24 hours.',
    policy: 'Terms §11: rights-holder correction and removal process',
    target: 'Listing',
    email: 'Your email (for our reply)',
    reason: 'Reason',
    detail: 'Details',
    placeholder: 'Explain the issue, correction, or evidence of ownership',
    warning:
      'A false or malicious report that disrupts a legitimate listing may result in legal liability.',
    submit: 'Submit report',
    successTitle: 'Report received',
    successText: 'We will review it within 24 hours. The listing has been hidden.',
    failed: 'Could not submit the report. Please try again shortly.',
    network: 'Could not connect to the server.',
    reasons: [
      'Copyright infringement (unauthorized image or text)',
      'Incorrect information (date, place, etc.)',
      'I operate this pop-up and did not consent to the listing',
      'Other',
    ],
  },
  ja: {
    title: '情報の修正・削除を申請',
    description:
      '情報の誤りや権利侵害がある場合はお知らせください。受付後すぐに非表示にし、24時間以内に確認します。',
    policy: '利用規約 第11条：権利者による修正・削除申請',
    target: '対象のポップアップ',
    email: '申請者のメール（返信用）',
    reason: '申請理由',
    detail: '詳細',
    placeholder: '具体的な理由、正しい情報、権利を示す情報など',
    warning: '虚偽または悪意ある申請で正当な掲載を妨害した場合、法的責任が生じることがあります。',
    submit: '申請を送信',
    successTitle: '申請を受け付けました',
    successText: '24時間以内に確認します。対象情報はすぐに非表示になります。',
    failed: '申請を送信できませんでした。しばらくしてからもう一度お試しください。',
    network: 'サーバーに接続できませんでした。',
    reasons: [
      '著作権侵害（画像・文章の無断使用）',
      '情報が不正確（日付・場所など）',
      '自分が運営するポップアップが同意なく掲載されている',
      'その他',
    ],
  },
} as const;

/**
 * 권리자(또는 부정확한 정보를 발견한 사람)가 자동수집된 팝업의
 * 정보 삭제·수정을 요청하는 폼.
 *
 * 백엔드: POST /api/popups/{id}/takedown
 * → 즉시 reviewStatus='TAKEDOWN' 으로 변경, 24시간 내 admin 검토 (이용약관 §11).
 */
export function TakedownModal({ open, onOpenChange, popupId, popupName }: TakedownModalProps) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [requesterEmail, setRequesterEmail] = useState('');
  const [reasonType, setReasonType] = useState<(typeof REASON_OPTIONS)[number]>(REASON_OPTIONS[0]);
  const [reasonDetail, setReasonDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      // 서버와 관리자 기록에는 화면 언어가 아닌 일정한 한국어 분류명을 남긴다.
      const finalReason = `[${CANONICAL_REASON[reasonType]}] ${reasonDetail}`.slice(0, 500);

      const res = await apiFetch(`/api/popups/${popupId}/takedown`, {
        method: 'POST',
        body: JSON.stringify({
          requesterEmail,
          reason: finalReason,
        }),
      });

      if (res.ok) {
        await notifySuccess({
          title: copy.successTitle,
          text: copy.successText,
        });
        onOpenChange(false);
        // 모달 외부 페이지가 새로고침되도록 살짝 반영하거나 caller 가 처리
        setRequesterEmail('');
        setReasonDetail('');
      } else {
        notifyError(copy.failed);
      }
    } catch {
      notifyError(copy.network);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-red-500" aria-hidden />
            {copy.title}
          </DialogTitle>
          <DialogDescription>
            {copy.description}
            <br />({copy.policy})
          </DialogDescription>
        </DialogHeader>

        {popupName && (
          <p className="text-sm text-muted-foreground border-l-2 border-red-500 pl-3 mb-2">
            {copy.target}: <span className="font-bold text-foreground">{popupName}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={copy.email} required>
            <Input
              type="email"
              required
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label={copy.reason} required>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value as (typeof REASON_OPTIONS)[number])}
              className="h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {REASON_OPTIONS.map((value, index) => (
                <option key={value} value={value}>
                  {copy.reasons[index]}
                </option>
              ))}
            </select>
          </Field>

          <Field label={copy.detail}>
            <textarea
              rows={4}
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              maxLength={400}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder={copy.placeholder}
            />
          </Field>

          <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            ⚠️ {copy.warning}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={submitting}
            iconLeft={<ShieldAlert className="size-4" aria-hidden />}
          >
            {copy.submit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
