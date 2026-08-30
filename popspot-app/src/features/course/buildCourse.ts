import { optimizeRoute, type RouteStop } from '@/lib/optimizeRoute';
import { matchesMood, type Mood } from '@/lib/moods';
import { walkInfo } from '@/lib/walkGroups';
import type { PopupStore } from '@/types/popup';

/**
 * 무드 하나로 코스를 만든다 — 시안 10.
 *
 * <p><b>여기에 AI 는 없다.</b> 시안은 "AI가 동선을 계산하는 중" 이라고 적었지만, 실제로 일어나는
 * 일은 세 단계다 — 무드에 드는 팝업을 고르고, 내 위치에서 가까운 것부터 몇 곳을 추리고, 최근접
 * 이웃으로 순서를 짠다. 그 셋 다 이 파일 안에서 끝나고 서버도 모델도 부르지 않는다.
 *
 * <p>부르지 않는 것을 불렀다고 말하면 두 가지를 잃는다. 사용자는 결과가 이상할 때 왜 그런지
 * 물을 수 없게 되고, 우리는 나중에 진짜 추천 모델을 붙일 때 <b>이미 그렇게 하고 있다고 말해 둔
 * 탓에</b> 그것을 개선으로 내보일 수 없다.
 */

/** 코스에 담는 곳 수. 시안의 코스가 4곳이고, 도보로 하루에 도는 현실적인 상한이기도 하다. */
export const COURSE_SIZE = 4;

/**
 * 순서를 짜기 전에 추려 두는 후보 수.
 *
 * <p>무드에 드는 팝업이 200곳이면 최근접이웃이 200곳을 훑는다 — 결과는 어차피 가까운 몇 곳에서
 * 나오는데 계산만 늘고, 더 나쁘게는 <b>반대편 동네의 같은 무드</b>가 섞여 들어온다. 가까운 순으로
 * 먼저 자르고 그 안에서 순서를 짠다.
 */
const CANDIDATE_POOL = 10;

export interface CourseStop extends RouteStop {
  popup: PopupStore;
  /** 앞 장소에서 여기까지. 첫 곳은 내 위치에서. */
  legText: string;
  legMinutes: number;
}

export interface Course {
  mood: Mood;
  stops: CourseStop[];
  /** 걷는 시간 합(분). */
  walkMinutes: number;
  /** 머무는 시간까지 더한 총 소요(분). */
  totalMinutes: number;
}

/** 한 곳에서 머무는 시간(분). 팝업 체류 시간은 백엔드에 없어 고정값을 쓴다. */
const STAY_MINUTES = 35;

function coordOf(popup: PopupStore): { lat: number; lng: number } | null {
  const lat = Number(String(popup.latitude ?? '').trim());
  const lng = Number(String(popup.longitude ?? '').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * 무드에 드는 팝업 중 가까운 곳들로 코스를 짠다.
 *
 * <p>좌표가 없는 팝업은 <b>뺀다.</b> 동선의 전부가 "어디서 어디까지 몇 분" 인데, 좌표가 없으면 그
 * 질문에 답할 수 없다. 목록에서는 보여도 코스에는 못 넣는다.
 *
 * <p>후보가 두 곳도 안 되면 코스를 만들지 않는다({@code null}). 한 곳짜리 "코스" 는 코스가 아니라
 * 그냥 그 팝업이고, 그걸 코스라고 내놓으면 다음에 이 버튼을 누르지 않는다.
 */
export function buildCourse(
  popups: PopupStore[],
  mood: Mood,
  origin: { lat: number; lng: number },
): Course | null {
  const candidates = popups
    .filter((p) => matchesMood(p.category, mood))
    .flatMap((popup) => {
      const c = coordOf(popup);
      return c ? [{ popup, ...c, minutes: walkInfo(origin.lat, origin.lng, c.lat, c.lng).time }] : [];
    })
    .sort((a, b) => a.minutes - b.minutes || a.popup.id - b.popup.id)
    .slice(0, CANDIDATE_POOL);

  if (candidates.length < 2) return null;

  const picked: RouteStop[] = candidates.slice(0, COURSE_SIZE).map((c) => ({
    id: c.popup.id,
    name: c.popup.name,
    lat: c.lat,
    lng: c.lng,
    stayMinutes: STAY_MINUTES,
  }));

  const route = optimizeRoute(origin, picked, { useCongestion: false, useHours: false });

  let from = origin;
  const stops: CourseStop[] = route.stops.map((stop) => {
    const leg = walkInfo(from.lat, from.lng, stop.lat, stop.lng);
    from = stop;
    const popup = candidates.find((c) => c.popup.id === stop.id)!.popup;
    return { ...stop, popup, legText: `도보 ${leg.time}분 · ${leg.dist}`, legMinutes: leg.time };
  });

  const walkMinutes = stops.reduce((sum, s) => sum + s.legMinutes, 0);
  return {
    mood,
    stops,
    walkMinutes,
    totalMinutes: walkMinutes + stops.length * STAY_MINUTES,
  };
}

/** "3시간 20분" 처럼. 60분 미만이면 분만. */
export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
