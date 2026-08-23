'use client';

import { useEffect, useMemo, useState } from 'react';

import { daysUntilEnd } from '@/lib/dday';
import { readVisits, type RecentVisit } from '@/lib/recentVisits';
import type { PopupStore } from '@/types/popup';

/**
 * 본 팝업 중 아직 진행 중인 것을 마감일 순으로.
 *
 * <p>최근 방문 기록에는 팝업 날짜가 없다 — {@code visitedAt} 은 본 시각이다. 그래서 마감일은
 * {@code popupId} 로 팝업 목록과 맞춰서 얻는다. 넘겨받는 목록이 "지금 열린 것" 이면 종료된
 * 팝업은 애초에 거기 없으므로, <b>제외 규칙이 조인만으로 지켜진다.</b>
 *
 * <p>{@code readVisits} 가 돌려주는 값은 검증되지 않은 localStorage 내용이다(모양 검사 없이
 * 캐스팅한다). 손으로 고친 저장소나 옛 형식이 들어와도 화면이 죽지 않게 항목마다 막는다. 특히
 * popupId 가 숫자 문자열이면 숫자로 읽는다 — 옛 형식을 거부하면 방문 이력이 조용히 사라지는데,
 * 사용자가 다시 들을 수 없는 것은 잃으면 돌이킬 수 없다.
 */
export function selectMySchedule(
  visits: Pick<RecentVisit, 'popupId'>[],
  popups: PopupStore[],
  now: Date = new Date(),
): PopupStore[] {
  const byId = new Map<number, PopupStore>();
  for (const popup of popups) {
    if (popup) byId.set(popup.id, popup);
  }

  const seen = new Set<number>();
  const picked: { popup: PopupStore; days: number }[] = [];

  for (const visit of visits) {
    const id = Number(visit?.popupId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);

    const popup = byId.get(id);
    if (!popup) continue;

    const days = daysUntilEnd(popup.endDate, now);
    if (days === null || days < 0) continue;

    picked.push({ popup, days });
  }

  return picked.sort((a, b) => a.days - b.days).map((x) => x.popup);
}

/**
 * 위를 화면에서 쓰기 위한 훅.
 *
 * <p>{@code readVisits} 를 렌더 중에 부르지 않고 효과로 미룬다. localStorage 는 서버에 없으므로
 * 렌더 중에 읽으면 서버가 그린 것과 첫 클라이언트 렌더가 어긋난다 — 처음에는 서버와 같은 빈
 * 목록으로 그리고, 붙은 뒤에 채운다.
 */
export function useMySchedule(popups: PopupStore[]): PopupStore[] {
  const [visits, setVisits] = useState<RecentVisit[]>([]);

  useEffect(() => {
    setVisits(readVisits());
  }, []);

  return useMemo(() => selectMySchedule(visits, popups), [visits, popups]);
}
