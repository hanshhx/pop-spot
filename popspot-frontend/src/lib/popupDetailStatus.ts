import { isExpired, kstTodayStart } from './popupSlices';
import { popupStatusLabel } from './popupLocale';
import type { MessageKey } from './i18n';

type Translate = (key: MessageKey) => string;

/**
 * 팝업 상세의 상태 배지가 "끝났다"고 볼 근거가 있는가.
 *
 * <p>두 근거를 <b>OR</b> 로 본다.
 *
 * <ul>
 *   <li>종료일이 지났으면 끝난 것이다. 백엔드 스케줄러가 {@code status} 를 {@code EXPIRED} 로
 *       바꾸는 것은 하루 1회 배치라({@code PopupStoreService#isEnded} 주석), 그 사이 최대 24시간은
 *       종료일이 지났는데도 {@code status} 가 여전히 "영업중"일 수 있다. 날짜를 함께 보지 않으면
 *       그 창(window)에서 라임(운영중) 배지가 뜬다.
 *   <li>반대로 종료일을 못 읽거나(형식 이상, 아예 없음) {@code status} 가 이미
 *       {@code EXPIRED}/종료 라면 그 값을 믿는다 — 날짜만 보면 이 경우를 놓친다.
 * </ul>
 *
 * <p>{@code dday.ts} 의 {@code daysUntilEnd} 대신 {@link isExpired}/{@link kstTodayStart} 를 쓰는
 * 이유는 {@code dday.ts} 가 로컬 {@code setHours} 로 "오늘"을 계산해서다 — Vercel(UTC) 배포에서는
 * KST 00:00~09:00 사이 9시간 동안 "오늘"이 어제로 밀린다(자세한 실측은 {@code kstCalendarDate}
 * 주석). 상태 배지 색이 매일 그 9시간만 잘못되는 것은 원인을 찾기 어려운 버그라 처음부터 KST 기준
 * 함수를 쓴다.
 */
export function isPopupEnded(
  status: string | null | undefined,
  closeDate: string | null | undefined,
  today: Date = kstTodayStart(),
): boolean {
  return isExpired(closeDate, today) || status === 'EXPIRED' || status === '종료';
}

/**
 * 상세 페이지 상태 배지 문구.
 *
 * <p>끝났으면({@code ended}) {@code status} 문자열이 뭐라 하든 '종료'다 — {@link isPopupEnded} 의
 * 첫 번째 근거처럼 {@code status} 가 아직 스케줄러 지연으로 낡아 있을 수 있어, 날짜 쪽 판정이
 * 우선한다.
 *
 * <p>안 끝났고 {@code status} 값이 있으면 {@link popupStatusLabel} 에 맡긴다 — OPEN/영업중/운영중/
 * EXPIRED/종료/혼잡도 값을 이미 안다. 여기서 같은 매핑을 다시 만들지 않는다.
 *
 * <p>{@code status} 자체가 없으면(빈 문자열·null·undefined) <b>'영업중'으로 넘겨짚지 않는다.</b>
 * 예전 코드는 이 자리에 {@code t('status.open')} 을 기본값으로 뒀는데, 그러면 상태를 전혀 모르는
 * 팝업도 "운영 중"이라고 단정해 보여줬다 — 근거 없이 확신하는 쪽이 아무 말 안 하는 쪽보다 나쁘다.
 */
export function detailStatusLabel(
  status: string | null | undefined,
  ended: boolean,
  t: Translate,
): string {
  if (ended) return t('misc.cardEnded');
  if (status?.trim()) return popupStatusLabel(status, t);
  return t('status.unknown');
}
