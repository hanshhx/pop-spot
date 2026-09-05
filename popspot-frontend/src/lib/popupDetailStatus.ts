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
  // popupStatusLabel 은 이제 status 가 비어 있으면 null 을 돌려준다(근거 없는 "영업중" 단정을
  // 멈췄기 때문) — 그 null 을 여기서 단정으로 되살리지 않고 아래 날짜 파생 분기로 흘려보낸다.
  const label = status?.trim() ? popupStatusLabel(status, t) : null;
  if (label) return label;

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

/**
 * 상세 페이지의 기간 옆에 붙일 남은 기간 배지.
 *
 * <p><b>왜 생겼나.</b> 여기는 {@code ddayLabel} 이라는 이름으로 상세 화면 안에 있었고,
 * 종료일 하나만 보고 {@code D-n} 을 만들었다. 그래서 <b>아직 열지도 않은 팝업에 마감까지 남은
 * 날이 붙었다</b> — 릴 X 토니노 람보르기니(09-15~09-23)를 09-05 에 열면 배지는 '오픈 예정'
 * 인데 그 옆이 'D-18' 이었다. 사람은 그것을 "18일 뒤에 연다"로 읽는데 실제로는 10일 뒤였다.
 *
 * <p>같은 결함을 랜딩 목록에서는 이미 고쳤다({@code ddayBadge} 의 "아직 안 연 것에 '진행 중' 을
 * 달던 자리다" 주석). {@code dday.ts} 가 "같은 산수가 세 곳에 복사돼 있던 것을 모았다"고 적어
 * 둔 그대로, 한 벌만 고쳐지고 이쪽이 남아 있었다.
 *
 * <p><b>'오늘'을 {@link kstTodayStart} 로 세는 것도 옮긴 이유다.</b> 예전 구현은 {@code dday.ts}
 * 의 {@code daysUntilEnd} 를 기본 인자로 불렀는데, 그쪽은 로컬 {@code setHours} 로 오늘을
 * 만든다. 이 화면은 서버에서도 한 번 그려지므로(Vercel = UTC) KST 00:00~09:00 사이에는 서버가
 * 센 날짜가 하루 밀린다 — 바로 옆 상태 배지는 KST 로 세고 있어서, <b>한 줄 안에서 두 값이 서로
 * 다른 오늘</b>을 쓰고 있었다.
 *
 * <p>문구가 아니라 <b>무엇인지</b>를 돌려준다. 화면이 {@code === '종료'} 로 되묻는 식이면
 * 문구를 옮기는 순간 판단이 빗나간다({@code DdayBadge} 가 같은 이유로 그렇게 되어 있다).
 */
export type DetailPeriodBadge =
  | { kind: 'ended' }
  | { kind: 'closing-today' }
  | { kind: 'closes-in'; days: number }
  | { kind: 'opens-in'; days: number };

/**
 * 기간 배지에 무엇을 쓸지 정한다. 셀 날짜가 없으면 null(배지를 안 그린다).
 *
 * <p>{@link landingStatus} 에 맡기고 그 답을 옮기기만 한다 — 시작일·종료일을 둘 다 보는 산수를
 * 여기서 다시 쓰면 또 한 벌이 늘어난다.
 */
export function detailPeriodBadge(
  openDate: string | null | undefined,
  closeDate: string | null | undefined,
  today: Date = kstTodayStart(),
): DetailPeriodBadge | null {
  // 날짜가 하나도 안 읽히면 셀 것이 없다. landingStatus 는 이 경우 'ongoing' 을 주는데
  // (그쪽은 이미 걸러진 목록을 전제한다), 상세는 어떤 팝업이든 URL 로 바로 열리므로
  // 그 전제가 없다 — detailStatusLabel 이 같은 이유로 같은 검사를 먼저 한다.
  if (!parseDate(openDate) && !parseDate(closeDate)) return null;

  const derived = landingStatus(openDate ?? null, closeDate ?? null, today);
  if (derived.kind === 'ended') return { kind: 'ended' };
  if (derived.kind === 'upcoming') return { kind: 'opens-in', days: derived.opensIn };
  if (derived.dday === null) return null; // 상시 운영 — 마감을 셀 수 없다.
  if (derived.dday === 0) return { kind: 'closing-today' };
  return { kind: 'closes-in', days: derived.dday };
}

/**
 * 이 배지를 <b>강조색</b>으로 그릴 것인가.
 *
 * <p>강조는 "서둘러라" 는 신호다. 그러니 마감이 걸린 것에만 준다 — 끝난 것은 서둘러도 소용이
 * 없고, 아직 안 연 것은 서두를 일이 아니다. 열흘 뒤에 여는 팝업에 마감 임박과 같은 색을 주면
 * 두 상황을 구분할 수 없다(랜딩 목록이 upcoming 을 중립색으로 두는 것과 같은 판단이다).
 *
 * <p>화면이 아니라 여기서 정하는 이유 — 예전에는 화면이 {@code dday === t('detail.ended')} 로
 * <b>보이는 글자를 되물어</b> 색을 골랐다. 문구를 옮기는 순간 비교가 빗나가 끝난 팝업까지
 * 강조색을 달게 된다. {@code dday.ts} 의 {@code DdayBadge} 가 같은 이유로 문구와 판단을 갈라 뒀다.
 */
export function isUrgentPeriod(badge: DetailPeriodBadge | null): boolean {
  return badge !== null && (badge.kind === 'closing-today' || badge.kind === 'closes-in');
}
