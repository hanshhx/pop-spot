'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { notifySuccess, notifyError } from '@/lib/notify';
import type { FeedbackCategory, FeedbackCreatePayload } from '@/types/feedback';

import { createFeedback } from './api';

interface FeedbackFormProps {
  /** 로그인 사용자 ID. 없으면 게스트 폼으로 표시. */
  userId: string | null;
  /** 작성 성공 후 콜백 (목록 갱신/모달 닫기 등). */
  onSubmitted?: () => void;
}

const CATEGORY_ORDER: FeedbackCategory[] = ['BUG', 'FEATURE', 'GOOD', 'OTHER'];

/**
 * 카테고리는 <b>보내는 값과 보이는 문구를 나눈다.</b>
 *
 * <p>{@code BUG · FEATURE …} 는 서버가 검증하는 화이트리스트라 화면 언어와 무관해야 하고, 옆에 붙는
 * 라벨만 사전에서 꺼낸다. 공용 {@code CATEGORY_LABEL} 을 고치지 않고 여기에 키 매핑을 둔 것은 그
 * 상수를 관리자 화면도 함께 쓰고 있어, 지금 손대면 아직 옮기지 않은 화면의 문구까지 흔들리기 때문이다.
 */
const CATEGORY_LABEL_KEY: Record<FeedbackCategory, MessageKey> = {
  BUG: 'fb.catBug',
  FEATURE: 'fb.catFeature',
  GOOD: 'fb.catGood',
  OTHER: 'fb.catOther',
};

const TITLE_MAX = 200;
const CONTENT_MAX = 4000;

/**
 * 의견 보내기 입력 폼.
 *
 * <p>로그인 사용자는 이메일 칸이 보이지 않고, 게스트는 답신용 이메일을 선택 입력할 수 있다.
 * 화이트리스트 카테고리 4종을 라디오로 받는다.
 */
export function FeedbackForm({ userId, onSubmitted }: FeedbackFormProps) {
  const { t } = useLocale();
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
      notifyError(t('fb.titleRequired'));
      return;
    }
    if (!payload.content) {
      notifyError(t('fb.contentRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await createFeedback(payload);
      await notifySuccess({
        title: t('fb.sentTitle'),
        text: t('fb.sentText'),
      });
      setTitle('');
      setContent('');
      setGuestEmail('');
      onSubmitted?.();
    } catch (err) {
      // 서버가 준 사유가 있으면 그대로 보여준다 — 어느 칸이 문제인지까지 알려주는 쪽이 더 쓸모 있다.
      const message = err instanceof Error ? err.message : t('fb.sendFailed');
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label={t('fb.typeLabel')} required>
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
                {t(CATEGORY_LABEL_KEY[value])}
              </label>
            );
          })}
        </div>
      </Field>

      <Field label={t('fb.titleLabel')} required>
        <Input
          name="title"
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('fb.titlePlaceholder')}
        />
      </Field>

      <Field label={t('fb.contentLabel')} required helper={`${content.length} / ${CONTENT_MAX}`}>
        <textarea
          name="content"
          required
          maxLength={CONTENT_MAX}
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full resize-none rounded-md border border-[var(--color-border-strong)] bg-surface p-3 text-sm text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={t('fb.contentPlaceholder')}
        />
      </Field>

      {isGuest && (
        <Field label={t('fb.emailLabel')} helper={t('fb.emailHelper')}>
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
        {t('fb.submit')}
      </Button>
    </form>
  );
}
