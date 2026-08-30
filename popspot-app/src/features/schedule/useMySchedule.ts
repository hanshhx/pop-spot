import { useMemo } from 'react';

import { useRecentPopups } from '@/features/popup/useRecentPopups';
import { daysUntilEnd } from '@/lib/dday';
import type { RecentVisit } from '@/lib/recentVisits';
import type { PopupStore } from '@/types/popup';

/**
 * 본 팝업 중 아직 진행 중인 것을 마감일 순으로 — 웹 {@code src/features/schedule/useMySchedule.ts}
 * 를 그대로 옮긴 것.
 *
 * <p>최근 방문 기록에는 팝업 날짜가 없다 — {@code visitedAt} 은 본 시각이다. 그래서 마감일은
 * {@code popupId} 로 팝업 목록과 맞춰서 얻는다. 넘겨받는 목록이 "지금 열린 것"({@code open})이면
 * 종료된 팝업은 애초에 거기 없으므로, <b>제외 규칙이 조인만으로 지켜진다.</b>
 *
 * <p>{@code popupId} 가 숫자 문자열이면 숫자로 읽는다 — 옛 형식을 거부하면 방문 이력이 조용히
 * 사라지는데, 사용자가 다시 만들 수 없는 것은 잃으면 돌이킬 수 없다.
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
 * <p>웹은 여기서 {@code readVisits} 를 효과로 미루는데, 그건 서버 렌더와 첫 클라이언트 렌더를
 * 맞추기 위한 것이다. 앱에는 서버 렌더가 없으므로 {@code useRecentPopups} 가 이미 하고 있는
 * 비동기 읽기를 그대로 쓴다 — 저장소를 두 곳에서 읽으면 상세에서 남긴 기록이 이 화면에 늦게
 * 반영되는 어긋남이 생긴다.
 */
export function useMySchedule(popups: PopupStore[]): PopupStore[] {
  const { visits } = useRecentPopups();
  return useMemo(() => selectMySchedule(visits, popups), [visits, popups]);
}
