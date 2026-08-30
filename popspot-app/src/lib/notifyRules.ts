/**
 * 알림을 보내도 되는가 — 시안이 알림 센터 아래 적어 둔 세 줄을 코드로.
 *
 * <p><i>"알림은 09:00~21:00에만 보냅니다. 하루 최대 2건, 같은 팝업은 24시간에 1건."</i>
 *
 * <p>이 규칙을 화면이 아니라 여기 두는 이유는, <b>알림은 화면이 없을 때 나가기 때문</b>이다.
 * 백그라운드에서 도는 코드가 같은 규칙을 따라야 하는데, 컴포넌트 안에 있으면 그럴 수 없다.
 *
 * <p>시안 노트가 왜 3종만 켜는지도 적어 두었다 — <b>과다 발송이 이탈 1순위</b>. 그래서 이 파일은
 * 보내는 법이 아니라 <b>안 보내는 법</b>을 담는다.
 */

/** 시안이 켜기로 한 알림 종류. */
export type NotifyKind =
  /** 찜한 팝업이 사흘 뒤 끝날 때. */
  | 'wishClosing'
  /** 코스를 도는 중 다음 장소가 가까울 때. */
  | 'courseNext'
  /** 주간 요약. */
  | 'weekly'
  /** 관심 분야에 새 팝업. 기본 꺼짐. */
  | 'newPopup';

export interface NotifySettings {
  wishClosing: boolean;
  courseNext: boolean;
  weekly: boolean;
  newPopup: boolean;
}

/** 시안의 기본값 — 새 팝업만 꺼져 있다. */
export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  wishClosing: true,
  courseNext: true,
  weekly: true,
  newPopup: false,
};

/** 보낼 수 있는 시간대. 밖이면 보내지 않는다. */
export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 9;

/** 하루에 보낼 수 있는 최대 건수. */
export const MAX_PER_DAY = 2;

/** 같은 팝업으로 다시 보내기까지 기다리는 시간. */
const SAME_POPUP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** 이미 보낸 기록 한 줄. */
export interface SentRecord {
  kind: NotifyKind;
  /** 이 알림이 가리키는 팝업. 주간 요약처럼 특정 팝업이 없으면 null. */
  popupId: number | null;
  at: number;
}

export interface NotifyRequest {
  kind: NotifyKind;
  popupId: number | null;
}

/**
 * 왜 안 보내는지.
 *
 * <p>불리언 하나로 돌려주면 로그에 "안 보냄" 만 남아, 발송이 조용히 멈췄을 때 원인을 찾을 수 없다.
 */
export type NotifyDecision =
  | { send: true }
  | { send: false; reason: 'off' | 'quietHours' | 'dailyLimit' | 'samePopupCooldown' };

/** 지금이 조용한 시간인가. 21시부터 다음 날 9시까지. */
export function isQuietHour(now: Date): boolean {
  const hour = now.getHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** 같은 날인가. 하루 상한을 세기 위한 것 — 로컬 자정을 기준으로 한다. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 이 알림을 지금 보내도 되는가.
 *
 * <p>검사 순서에 뜻이 있다. <b>설정 → 시간대 → 하루 상한 → 같은 팝업</b> 순인데, 앞의 것일수록
 * 사용자가 명시적으로 정한 것이다. 꺼 놓은 알림이 "하루 상한 때문에" 안 나갔다고 기록되면 설정을
 * 껐다는 사실이 로그에서 사라진다.
 */
export function canNotify(
  request: NotifyRequest,
  settings: NotifySettings,
  sent: SentRecord[],
  now: Date,
): NotifyDecision {
  if (!settings[request.kind]) return { send: false, reason: 'off' };
  if (isQuietHour(now)) return { send: false, reason: 'quietHours' };

  const today = sent.filter((s) => sameDay(new Date(s.at), now));
  if (today.length >= MAX_PER_DAY) return { send: false, reason: 'dailyLimit' };

  if (request.popupId !== null) {
    const recent = sent.some(
      (s) => s.popupId === request.popupId && now.getTime() - s.at < SAME_POPUP_COOLDOWN_MS,
    );
    if (recent) return { send: false, reason: 'samePopupCooldown' };
  }

  return { send: true };
}

/**
 * 오래된 기록을 버린다.
 *
 * <p>기록은 규칙을 지키기 위해서만 갖고 있다. 가장 긴 규칙이 24시간이므로 이틀이면 넉넉하고,
 * 그보다 오래 두면 <b>무엇을 언제 봤는지가 기기에 계속 쌓인다</b>.
 */
export function pruneSent(sent: SentRecord[], now: Date): SentRecord[] {
  const cutoff = now.getTime() - 2 * SAME_POPUP_COOLDOWN_MS;
  return sent.filter((s) => s.at >= cutoff);
}
