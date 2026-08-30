import { Linking } from 'react-native';

/**
 * 팝업 기간을 사용자 캘린더에 담는다 — 웹 {@code src/lib/calendar.ts} 의 앱 판.
 *
 * <p><b>검증된 날짜만.</b> 시작일·종료일이 둘 다 유효한 YYYY-MM-DD 이고 시작 ≤ 종료일 때만
 * 이벤트를 만든다. 하나라도 없으면 {@link toCalendarEvent} 가 null 을 돌려주고, 호출부는
 * <b>버튼 자체를 그리지 않는다</b>. 지어낸 일정을 남의 달력에 넣는 것은 정보가 없는 것보다 나쁘다.
 *
 * <h3>웹과 다른 한 가지 — 플랫폼 분기를 하지 않는다</h3>
 *
 * <p>웹은 iOS 에 {@code .ics} 파일을 내려 주고 그 밖에는 Google Calendar 딥링크를 쓴다. 앱은
 * <b>두 플랫폼 모두 Google Calendar URL</b> 을 연다.
 *
 * <p>{@code .ics} 를 만들려면 파일을 쓰고 공유 시트를 띄워야 하는데({@code expo-file-system} +
 * {@code expo-sharing}), 둘 다 지금 앱에 없는 네이티브 모듈이다. 넣으면 <b>스토어에 올릴 빌드를
 * 다시 만들어야 한다</b> — 캘린더 담기 하나 때문에 치를 값이 아니다. Google Calendar URL 은
 * {@code Linking} 만 쓰므로 지금 빌드에서 그대로 돈다.
 *
 * <p>대신 잃는 것을 적어 둔다: iOS 에서 Google Calendar 앱이 없으면 브라우저로 열리고, 거기서
 * 로그인을 요구할 수 있다. 애플 캘린더에 바로 담기려면 {@code .ics} 가 필요하고, 그건 다음
 * 네이티브 빌드에 함께 넣는다.
 */

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CalendarInput {
  id: string | number;
  name: string;
  address?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CalendarEvent {
  title: string;
  location: string;
  url: string;
  /** 캘린더용 YYYYMMDD (종일 이벤트). */
  startCompact: string;
  /** 종일 이벤트의 종료는 exclusive 라 실제 종료일 + 1 일. */
  endExclusiveCompact: string;
}

/** YYYY-MM-DD 를 실제 유효 날짜로 파싱. 형식·실재 검증 실패 시 null. */
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = DATE_SHAPE.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

function compact(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${mo}${d}`;
}

/**
 * 검증된 이벤트를 만든다. 시작일·종료일이 둘 다 유효하고 시작 ≤ 종료일 때만. 그 외 null(버튼 숨김).
 */
export function toCalendarEvent(input: CalendarInput): CalendarEvent | null {
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!start || !end || start.getTime() > end.getTime()) return null;

  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return {
    title: input.name,
    location: input.address ?? '',
    url: `https://popspot.co.kr/popup/${input.id}`,
    startCompact: compact(start),
    endExclusiveCompact: compact(endExclusive),
  };
}

/**
 * Google Calendar 이벤트 생성 URL.
 *
 * <p>{@code URLSearchParams} 를 쓴다 — {@code App.tsx} 가 맨 위에서 부르는
 * {@code react-native-url-polyfill} 이 이것도 함께 채워 준다. 손으로 이어붙이면 팝업 이름의
 * {@code &} 하나가 파라미터를 잘라 제목이 사라진다.
 */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${ev.startCompact}/${ev.endExclusiveCompact}`,
    details: `팝스팟에서 보기: ${ev.url}`,
    location: ev.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * 캘린더 앱을 연다.
 *
 * <p><b>돌려받은 값으로 "저장됨" 을 알리지 않는다.</b> 여기서 아는 것은 "주소를 넘겼다" 까지이고,
 * 사용자가 캘린더에서 저장을 눌렀는지는 알 수 없다. 웹도 같은 이유로 반환값을 쓰지 않는다.
 *
 * <p>이벤트를 만들 수 없으면(날짜 미상) 아무것도 하지 않고 false — 호출부가 애초에 버튼을 그리지
 * 않으므로 여기에 닿을 일은 없지만, 닿아도 엉뚱한 날짜의 일정을 만들지는 않는다.
 */
export async function addToCalendar(input: CalendarInput): Promise<boolean> {
  const ev = toCalendarEvent(input);
  if (!ev) return false;
  try {
    await Linking.openURL(googleCalendarUrl(ev));
    return true;
  } catch {
    return false;
  }
}
