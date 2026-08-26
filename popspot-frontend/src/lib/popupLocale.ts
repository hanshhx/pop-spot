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

/**
 * 백엔드의 한국어·영어 상태 코드를 현재 화면 언어로 표시한다.
 *
 * <p>status 가 비어 있으면(빈 문자열·null·undefined) <b>null</b> 을 돌려준다. 예전엔 "모르면
 * 영업중"이라고 단정했지만, 실측으로는 근거가 없었다 — {@code /api/map/markers} 에는 status
 * 필드 자체가 없고, 상세 응답 표본도 전부 {@code status: null} 이었다. 이 함수는 <b>받은 것만</b>
 * 옮긴다. 날짜에서 상태를 다시 구하고 싶은 호출자는 {@code popupDetailStatus.ts} 의
 * {@code detailStatusLabel} 을 쓴다 — 거기는 null 을 날짜 파생 판정으로 이어받는다.
 */
export function popupStatusLabel(status: string | null | undefined, t: Translate): string | null {
  const normalized = status?.trim();
  if (!normalized) return null;
  const key = STATUS_KEY[normalized] ?? STATUS_KEY[normalized.toUpperCase()];
  return key ? t(key) : normalized;
}
