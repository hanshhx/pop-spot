import type { MessageKey } from './i18n';

/**
 * 남은 기간 배지에 필요한 것 — 무엇을 쓸지(labelKey · days)와 어떤 색으로 그릴지(ended).
 *
 * <p>문구와 <b>종료 여부를 나눠서</b> 돌려준다. 예전에는 '종료' 같은 문자열 하나만 주고 배지 색을
 * 고르는 쪽이 {@code dday === '종료'} 로 되물었는데, 그러면 문구를 옮기는 순간 비교가 빗나가
 * 끝난 팝업까지 라임색 배지를 달게 된다 — 보이는 글자와 판단 기준이 같은 값이면 늘 이렇게 된다.
 */
export interface DdayBadge {
  /** 정해진 문구가 있는 경우의 사전 키. 남은 일수를 세어 보여줄 때는 null. */
  labelKey: MessageKey | null;
  days: number;
  ended: boolean;
}

/**
 * 마감까지 남은 날. 마감일을 모르거나 읽을 수 없으면 null.
 *
 * <p>같은 산수가 카드·홈 벤토·상세에 각각 복사돼 있던 것을 여기로 모았다. 세 벌은 글자까지
 * 같았지만, 그렇게 둔 이상 언젠가 한 벌만 고쳐진다.
 *
 * <p>{@code now} 를 받는 이유는 두 값을 <b>같은 방식으로</b> 만들어야 시간대에 흔들리지 않기
 * 때문이다. 'YYYY-MM-DD' 는 UTC 자정으로 파싱되고 setHours 는 로컬 자정으로 내리므로, 두 날짜가
 * 함께 밀려 차이는 보존된다.
 */
export function daysUntilEnd(endDate?: string | null, now: Date = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/** 마감까지 남은 기간을 배지가 쓸 형태로. */
export function ddayBadge(endDate?: string | null, now: Date = new Date()): DdayBadge | null {
  const days = daysUntilEnd(endDate, now);
  if (days === null) return null;
  if (days < 0) return { labelKey: 'misc.cardEnded', days, ended: true };
  if (days === 0) return { labelKey: 'card.today', days: 0, ended: false };
  return { labelKey: null, days, ended: false };
}
