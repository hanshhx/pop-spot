'use client';

import { CalendarPlus } from 'lucide-react';

import { addToCalendar, toCalendarEvent, type CalendarInput } from '@/lib/calendar';

/**
 * "캘린더에 담기" — 랜딩 카드용.
 *
 * <p><b>왜 여기에 다는가.</b> 이 서비스는 주 920명이 오는데 <b>다시 오는 사람이 7명(0.76%)</b> 이다.
 * 코드에 사람을 다시 부르는 장치가 하나도 없다 — 알림도 구독도 없다. 캘린더는 그 자리를 메우는
 * 유일한 수단이면서, 알림을 우리가 아니라 사용자 폰이 쏘기 때문에 <b>운영 부담이 0</b> 이다.
 *
 * <p>상세 페이지에는 이미 있었다. 그런데 상세까지 내려오는 사람은 절반(49%)뿐이고, 모음까지
 * 오는 사람은 98% 다. 버튼을 볼 기회가 두 배가 된다.
 *
 * <p><b>목록 전체가 아니라 "지금 고른다면" 세 장에만 단다.</b> 서른 줄마다 붙이면 캘린더가
 * 지저분해져서 오히려 안 쓰게 된다. 고를지 말지 정하는 자리에만 둔다.
 *
 * <p>날짜가 온전하지 않으면 아무것도 그리지 않는다({@code toCalendarEvent} 가 null 을 준다).
 * 시작일이 없는 팝업이 290건이라, 없는 날짜로 일정을 만들면 사용자 캘린더에 쓰레기가 남는다.
 */
export function CalendarButton({ input, label }: { input: CalendarInput; label: string }) {
  if (!toCalendarEvent(input)) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // 카드 전체를 덮는 링크가 위에 있다. 막지 않으면 캘린더가 아니라 상세로 넘어간다.
        e.preventDefault();
        e.stopPropagation();
        addToCalendar(input);
      }}
      className="relative z-20 mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-lime-400 hover:text-foreground"
    >
      <CalendarPlus size={12} aria-hidden /> {label}
    </button>
  );
}
