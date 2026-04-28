"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { notifySuccess, notifyError } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TakedownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popupId: number;
  popupName?: string;
}

const REASON_OPTIONS = [
  { value: "COPYRIGHT", label: "저작권 침해 (이미지/문구 무단 사용)" },
  { value: "INACCURATE", label: "정보가 부정확함 (날짜/장소 등)" },
  { value: "OWNER_REQUEST", label: "본인이 운영하는 팝업이며 동의 없이 게시됨" },
  { value: "OTHER", label: "기타" },
];

/**
 * 권리자(또는 부정확한 정보를 발견한 사람)가 자동수집된 팝업의
 * 정보 삭제·수정을 요청하는 폼.
 *
 * 백엔드: POST /api/popups/{id}/takedown
 * → 즉시 reviewStatus='TAKEDOWN' 으로 변경, 24시간 내 admin 검토 (이용약관 §11).
 */
export function TakedownModal({
  open,
  onOpenChange,
  popupId,
  popupName,
}: TakedownModalProps) {
  const [requesterEmail, setRequesterEmail] = useState("");
  const [reasonType, setReasonType] = useState(REASON_OPTIONS[0].value);
  const [reasonDetail, setReasonDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const reasonLabel =
        REASON_OPTIONS.find((r) => r.value === reasonType)?.label ?? reasonType;
      const finalReason = `[${reasonLabel}] ${reasonDetail}`.slice(0, 500);

      const res = await apiFetch(`/api/popups/${popupId}/takedown`, {
        method: "POST",
        body: JSON.stringify({
          requesterEmail,
          reason: finalReason,
        }),
      });

      if (res.ok) {
        await notifySuccess({
          title: "신고가 접수되었습니다",
          text: "24시간 내 검토 후 조치합니다. 해당 정보는 즉시 노출이 차단됩니다.",
        });
        onOpenChange(false);
        // 모달 외부 페이지가 새로고침되도록 살짝 반영하거나 caller 가 처리
        setRequesterEmail("");
        setReasonDetail("");
      } else {
        notifyError("신고 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch {
      notifyError("서버와 연결할 수 없습니다.");
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
            정보 삭제·수정 요청
          </DialogTitle>
          <DialogDescription>
            본 팝업 정보가 부정확하거나 저작권을 침해한다고 판단되시면
            아래 폼으로 알려주세요. 접수 즉시 노출이 차단되며 24시간 내
            검토합니다.
            <br />
            (이용약관 §11 권리자 정보 삭제 요청 절차)
          </DialogDescription>
        </DialogHeader>

        {popupName && (
          <p className="text-sm text-muted-foreground border-l-2 border-red-500 pl-3 mb-2">
            대상 팝업:{" "}
            <span className="font-bold text-foreground">{popupName}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="신고자 이메일 (회신용)" required>
            <Input
              type="email"
              required
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="신고 사유" required>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value)}
              className="h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="상세 내용">
            <textarea
              rows={4}
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              maxLength={400}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-surface text-surface-foreground p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="구체적인 사유 / 정정 정보 / 권리 증빙 정보 등"
            />
          </Field>

          <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            ⚠️ 허위·악성 신고로 정상 콘텐츠의 노출을 방해한 경우 손해배상 책임이 발생할 수 있습니다.
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={submitting}
            iconLeft={<ShieldAlert className="size-4" aria-hidden />}
          >
            신고 제출
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
