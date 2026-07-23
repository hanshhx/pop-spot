/**
 * 팝업 기간을 사용자 캘린더에 추가한다.
 *
 * <p><b>플랫폼 분기가 핵심.</b> iOS 는 {@code .ics} 파일을 캘린더가 바로 연다. 하지만 <b>Android 의 Google Calendar 모바일은
 * .ics 를 import 하지 못한다</b> — 그래서 Android·데스크톱은 Google Calendar 의 이벤트 생성 URL(웹 딥링크)로 보낸다. 이 구분을 안 하면
 * Android 사용자는 버튼을 눌러도 아무 일도 일어나지 않는다.
 *
 * <p><b>검증된 날짜만.</b> 시작일·종료일이 둘 다 유효한 YYYY-MM-DD 일 때만 이벤트를 만든다. 하나라도 없으면 {@link toCalendarEvent} 가
 * null 을 돌려주고, 호출부는 버튼을 숨긴다. 날짜를 추측해 채우지 않는다.
 */

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CalendarInput {
  id: string | number;
  name: string;
  address?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface CalendarEvent {
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

/** Android·데스크톱용 Google Calendar 이벤트 생성 URL. */
function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${ev.startCompact}/${ev.endExclusiveCompact}`,
    details: `팝스팟에서 보기: ${ev.url}`,
    location: ev.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** iOS용 .ics 본문. */
function buildIcs(ev: CalendarEvent): string {
  // UID 는 안정적으로(같은 팝업은 같은 값) 두어 중복 등록을 캘린더가 합치게 한다.
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//popspot//KR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.startCompact}-${ev.url}`,
    // DTSTAMP 는 RFC 5545 에서 VEVENT 필수 — 없으면 엄격한 캘린더가 파일을 거부해 "추가해도 아무 일 없는" 버튼이 된다.
    `DTSTAMP:${icsTimestamp()}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    `LOCATION:${escapeIcs(ev.location)}`,
    `URL:${ev.url}`,
    `DTSTART;VALUE=DATE:${ev.startCompact}`,
    `DTEND;VALUE=DATE:${ev.endExclusiveCompact}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

function escapeIcs(v: string): string {
  return v.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

/** 파일 생성 시각 — RFC 5545 형식(UTC, {@code YYYYMMDDTHHMMSSZ}). */
function icsTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * 플랫폼에 맞게 캘린더에 추가한다. iOS 는 .ics 다운로드, 그 외는 Google Calendar 웹 딥링크.
 * 이벤트가 유효하지 않으면(날짜 미검증) 아무 것도 하지 않고 false 를 돌려준다.
 */
export function addToCalendar(input: CalendarInput): boolean {
  const ev = toCalendarEvent(input);
  if (!ev) return false;

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    downloadIcs(buildIcs(ev), ev.title);
  } else {
    window.open(googleCalendarUrl(ev), '_blank', 'noopener,noreferrer');
  }
  return true;
}

/** .ics 본문을 파일로 내려받게 한다(iOS 캘린더가 바로 연다). */
function downloadIcs(icsBody: string, filename: string): void {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

function isIOSDevice(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * 동행 약속(날짜 + 시간)을 캘린더에 실제로 추가한다.
 *
 * <p>상세 페이지의 종일 이벤트와 달리 시간이 있는 이벤트다. iOS 는 .ics, 그 외는 Google Calendar 딥링크. 날짜·시간이 유효하지 않으면 아무 것도
 * 하지 않고 {@code false} 를 돌려준다 — 호출부는 이 값을 보고 "추가했다" 는 가짜 성공 메시지를 띄우지 말아야 한다.
 */
export function addPromiseToCalendar(input: {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
}): boolean {
  const day = parseDate(input.date);
  const tm = /^(\d{1,2}):(\d{2})$/.exec((input.time ?? '').trim());
  if (!day || !tm) return false;

  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return false;

  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 약속 기본 2시간

  const fmt = (x: Date): string => {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}` +
      `T${p(x.getHours())}${p(x.getMinutes())}00`
    );
  };
  const startStr = fmt(start);
  const endStr = fmt(end);

  if (isIOSDevice()) {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//popspot//KR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${startStr}-${escapeIcs(input.title)}`,
      `DTSTAMP:${icsTimestamp()}`,
      `SUMMARY:${escapeIcs(input.title)}`,
      `LOCATION:${escapeIcs(input.location)}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    downloadIcs(ics, input.title);
  } else {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: input.title,
      dates: `${startStr}/${endStr}`,
      location: input.location,
    });
    window.open(
      `https://calendar.google.com/calendar/render?${params.toString()}`,
      '_blank',
      'noopener,noreferrer',
    );
  }
  return true;
}
