import { isExpired, kstTodayStart, parseDate } from './popupSlices';
import { landingStatus } from './landingStatus';
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
 * EXPIRED/종료/혼잡도 값을 이미 안다. 여기서 같은 매핑을 다시 만들지 않는다. <b>여기가
 * "명시적 status 가 날짜보다 우선한다"는 규칙이 지켜지는 지점이다</b> — 날짜는 이 분기 다음에야
 * 등장하는 폴백일 뿐, status 를 뒤집는 근거로 쓰지 않는다.
 *
 * <p>{@code status} 자체가 없으면(빈 문자열·null·undefined), 곧바로 '정보 없음'으로 넘어가지
 * 않는다. 먼저 {@code openDate}/{@code closeDate} 로 {@link landingStatus} 에 물어본다 — 실측
 * 마커 피드에서 1181건 중 619건이 종료일조차 없고 {@code status} 도 비어 있는 채로 시작일·종료일은
 * 멀쩡한 경우가 흔하다. 이 페이지는 "T1 암행천문(07-22~08-31)"처럼 마감 D-day 를 이미 날짜로
 * 계산해서 보여주면서, 바로 위 배지만 "모른다"고 말하면 <b>한 화면이 스스로와 모순</b>된다.
 *
 * <p>{@link landingStatus} 를 그대로 재사용하되 <b>날짜가 하나도 없을 때만은 예외로 다룬다.</b>
 * {@link landingStatus} 자신의 문서에 있듯 그 함수는 "날짜를 모르는 쪽은 열려 있는 것으로 본다"는
 * 전제를 깔고 있는데, 그 전제는 이미 필터를 통과한 목록(랜딩 페이지)에서만 성립한다 — 상세
 * 페이지는 어떤 팝업이든 URL 하나로 직접 열 수 있어 그 전제가 없다. 그래서 {@link parseDate} 로
 * 날짜가 <b>하나라도</b> 읽히는지부터 확인하고, 하나도 없을 때만 '정보 없음'을 최후의 수단으로
 * 쓴다 — 상태도 날짜도 없는 팝업은 실제로 존재한다(마커 피드 실측 기준).
 */
export function detailStatusLabel(
  status: string | null | undefined,
  ended: boolean,
  openDate: string | null | undefined,
  closeDate: string | null | undefined,
  t: Translate,
  today: Date = kstTodayStart(),
): string {
  if (ended) return t('misc.cardEnded');
  if (status?.trim()) return popupStatusLabel(status, t);

  const hasUsableDates = Boolean(parseDate(openDate) || parseDate(closeDate));
  if (hasUsableDates) {
    const derived = landingStatus(openDate ?? null, closeDate ?? null, today);
    if (derived.kind === 'upcoming') return t('status.upcoming');
    if (derived.kind === 'ended') return t('misc.cardEnded'); // 방어적 분기 — ended 가 이미 이 경우를
    // 걸렀어야 정상이다(isExpired 와 같은 산수). 그래도 여기 남겨 두는 편이 '영업중'으로
    // 잘못 새는 것보다 안전하다.
    return t('status.open'); // 'ongoing'
  }

  return t('status.unknown');
}
