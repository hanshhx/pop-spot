import type { MessageKey } from '@/lib/i18n';

type Translate = (key: MessageKey) => string;

const STATUS_KEY: Record<string, MessageKey> = {
  OPEN: 'status.open',
  ACTIVE: 'status.open',
  영업중: 'status.open',
  운영중: 'status.open',
  여유: 'status.여유',
  보통: 'status.보통',
  혼잡: 'status.혼잡',
  EXPIRED: 'misc.cardEnded',
  종료: 'misc.cardEnded',
};

/** 백엔드의 한국어·영어 상태 코드를 현재 화면 언어로 표시한다. */
export function popupStatusLabel(status: string | null | undefined, t: Translate): string {
  const normalized = status?.trim();
  if (!normalized) return t('status.open');
  const key = STATUS_KEY[normalized] ?? STATUS_KEY[normalized.toUpperCase()];
  return key ? t(key) : normalized;
}
