'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { notifySuccess, notifyError } from '@/lib/notify';
import {
  CATEGORY_LABEL,
  type FeedbackCategory,
  type FeedbackCreatePayload,
} from '@/types/feedback';

import { createFeedback } from './api';

interface FeedbackFormProps {
  /** 로그인 사용자 ID. 없으면 게스트 폼으로 표시. */
  userId: string | null;
  /** 작성 성공 후 콜백 (목록 갱신/모달 닫기 등). */
  onSubmitted?: () => void;
}

const CATEGORY_ORDER: FeedbackCategory[] = ['BUG', 'FEATURE', 'GOOD', 'OTHER'];

const TITLE_MAX = 200;
const CONTENT_MAX = 4000;

/**
 * 의견 보내기 입력 폼.
 *
 * <p>로그인 사용자는 이메일 칸이 보이지 않고, 게스트는 답신용 이메일을 선택 입력할 수 있다.
 * 화이트리스트 카테고리 4종을 라디오로 받는다.
 */
export function FeedbackForm({ userId, onSubmitted }: FeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory>('BUG');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isGuest = !userId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const payload: FeedbackCreatePayload = {
      category,
      title: title.trim(),
      content: content.trim(),
    };
    if (isGuest && guestEmail.trim()) {
      payload.guestEmail = guestEmail.trim();
    }

    if (!payload.title) {
      notifyError('제목을 입력해 주세요.');
      return;
    }
    if (!payload.content) {
      notifyError('내용을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await createFeedback(payload);
      await notifySuccess({
        title: '의견 보내기 완료',
        text: '확인 후 처리 결과를 알려 드리겠습니다.',
      });
      setTitle('');
      setContent('');
      setGuestEmail('');
      onSubmitted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '의견을 보내지 못했습니다.';
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="유형" required>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORY_ORDER.map((value) => {
            const active = category === value;
            return (
              <label
                key={value}
                className={
                  'flex cursor-pointer items-center justify-center rounded-md border ' +
                  'px-3 py-2 text-sm transition-colors ' +
                  (active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-[var(--color-border-strong)] bg-surface text-surface-foreground hover:bg-muted')
                }
              >
                <input
                  type="radio"
                  name="category"
                  value={value}
                  checked={active}
                  onChange={() => setCategory(value)}
                  className="sr-only"
                />
                {CATEGORY_LABEL[value]}
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="제목" required>
        <Input
          name="title"
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="한 줄로 요약해 주세요"
        />
      </Field>

      <Field label="내용" required helper={`${content.length} / ${CONTENT_MAX}`}>
        <textarea
          name="content"
          required
          maxLength={CONTENT_MAX}
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full resize-none rounded-md border border-[var(--color-border-strong)] bg-surface p-3 text-sm text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="언제, 어디서, 어떤 상황이었는지 자세히 적어 주세요."
        />
      </Field>

      {isGuest && (
        <Field label="답신용 이메일 (선택)" helper="입력하시면 처리 결과를 메일로 알려 드립니다.">
          <Input
            name="guestEmail"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="example@mail.com"
          />
        </Field>
      )}

      <Button type="submit" variant="primary" size="lg" block loading={submitting}>
        보내기
      </Button>
    </form>
  );
}
