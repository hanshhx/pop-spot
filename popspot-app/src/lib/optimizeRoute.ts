import { walkInfo } from './walkGroups';

/**
 * 여러 곳을 도는 순서를 다시 짠다 — 웹 작전지도({@code app/planning/page.tsx})의 최근접이웃을
 * 모듈로 꺼낸 것.
 *
 * <p>웹에서는 이 알고리즘이 화면 컴포넌트 안에 함수로 박혀 있었다. 그 자리에 있으면 두 가지를 못
 * 한다 — 테스트할 수 없고, 두 번째 화면에서 쓸 수 없다. 앱의 최단 동선 플래너가 정확히 그 두 번째
 * 화면이라 여기로 옮긴다.
 *
 * <p><b>웹과 달라진 점은 출발점이다.</b> 웹은 목록의 첫 항목을 출발점으로 고정했다(여럿이 함께
 * 짜는 화면이라 "누구 위치" 라는 게 없었다). 앱은 내 위치가 있으므로 그쪽을 출발점으로 삼는다 —
 * 첫 항목을 고정하면 "가장 가까운 곳부터" 가 아니라 "목록에 먼저 담은 곳부터" 가 된다.
 *
 * <h3>왜 최근접이웃인가</h3>
 *
 * <p>최적해가 아니다. 외판원 문제라 정확히 풀려면 곳 수의 계승만큼 봐야 하고, 근사해도 2-opt 정도는
 * 돌려야 한다. 그런데 이 화면이 다루는 것은 <b>서너 곳</b>이다 — 시안의 코스도 4곳이고, 하루에 도보로
 * 도는 팝업이 그보다 많아지는 일은 드물다. 4곳이면 최근접이웃과 최적해가 대개 같은 답을 내고,
 * 다를 때도 몇 분 차이다. 알고리즘을 키우는 대신 <b>무엇을 비용으로 볼지</b>를 정확히 하는 쪽이
 * 실제로 아끼는 시간이 크다.
 */

export interface RouteStop {
  id: number;
  name: string;
  lat: number;
  lng: number;
  /** 도착했을 때 예상되는 대기(분). 모르면 0 으로 둔다 — 지어내지 않는다. */
  waitMinutes?: number;
  /** 이 곳에 머무는 시간(분). 시각 계산에만 쓴다. */
  stayMinutes?: number;
  /** 문 닫는 시각 {@code "19:00"}. 모르면 비운다. */
  closesAt?: string;
}

export interface OptimizeOptions {
  /** 대기 시간을 비용에 더한다. 붐비는 곳이 뒤로 밀린다. */
  useCongestion: boolean;
  /** 곧 닫는 곳을 앞으로 당긴다. */
  useHours: boolean;
  /** 출발 시각(분, 자정 기준). 운영시간을 볼 때만 쓴다. */
  departAtMinutes?: number;
}

export interface OptimizedRoute {
  stops: RouteStop[];
  /** 재배치 전 총 도보 분. */
  beforeMinutes: number;
  /** 재배치 후 총 도보 분. */
  afterMinutes: number;
  /** 아낀 분. 음수면 0 — 더 나빠진 순서를 "절약" 이라고 부르지 않는다. */
  savedMinutes: number;
}

/** 하루 여유의 상한(분). 자정까지 여는 곳이 무한정 뒤로 밀리지 않게 자른다. */
const SLACK_CAP_MINUTES = 240;

/**
 * 여유 1분을 도보 몇 분어치로 볼 것인가.
 *
 * <p>0.25 는 <b>여유 4분 = 도보 1분</b>이라는 뜻이다. 이 값을 크게 잡으면 마감이 순서를 통째로
 * 지배해서, 반대쪽 끝에 있는 곳을 먼저 가느라 도보가 늘어난다. 작게 잡으면 켜 놓으나 마나다.
 *
 * <p>실측으로 정한 값이 아니라 <b>시작값</b>이다. 성수 도보 이동이 대개 4~10분이고 팝업 마감이
 * 19:00~21:00 에 몰려 있어, 두 시간 여유 차이(=120분)가 도보 30분어치로 환산되는 지점을 잡았다.
 * 실제 코스 로그가 쌓이면 여기부터 다시 본다.
 */
const HOURS_WEIGHT = 0.25;

/** {@code "19:30"} → 1170. 읽을 수 없으면 null. */
export function minutesOfClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 도착해서 볼 것을 다 보고도 남는 시간(분). 적을수록 지금 가야 한다.
 *
 * <p><b>마감 시각을 모르면 상한을 돌려준다 — 0 이 아니다.</b> 가산식 비용에는 "중립" 값이 없어서,
 * 모르는 곳의 항을 0 으로 두면 그건 중립이 아니라 <b>여유가 0분이라는 뜻</b>이 된다. 그러면 마감을
 * 모르는 곳이 전부 가장 급한 곳으로 올라가, 실제로 곧 닫는 곳을 밀어낸다.
 *
 * <p>이 저장소는 같은 함정을 이미 겪었다. {@code popupBadges.ts} 는 날짜를 모르면 배지를 달지
 * 않고({@code 모르는 것을 급한 것으로 바꿔 말하지 않는다}), {@code popAllQuery.ts} 는 종료일 미상을
 * {@code Infinity} 로 맨 뒤에 둔다. 여기서만 다르게 굴 이유가 없다 — 근거가 없으면 앞으로 당기지
 * 않는다.
 */
function slackMinutes(
  from: { lat: number; lng: number },
  candidate: RouteStop,
  clockMinutes: number,
  walk: number,
  options: OptimizeOptions,
): number {
  const closes = minutesOfClock(candidate.closesAt);
  if (closes === null) return SLACK_CAP_MINUTES;

  const arrival = clockMinutes + walk + (options.useCongestion ? (candidate.waitMinutes ?? 0) : 0);
  const slack = closes - arrival - (candidate.stayMinutes ?? 0);
  return Math.min(Math.max(slack, 0), SLACK_CAP_MINUTES);
}

/** 두 지점 사이 도보 분. */
function legMinutes(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return walkInfo(a.lat, a.lng, b.lat, b.lng).time;
}

/** 출발점에서 이 순서대로 걸었을 때의 총 도보 분. */
export function totalWalkMinutes(
  origin: { lat: number; lng: number },
  stops: RouteStop[],
): number {
  let from = origin;
  let sum = 0;
  for (const stop of stops) {
    sum += legMinutes(from, stop);
    from = stop;
  }
  return sum;
}

/**
 * 지금 이 후보를 고르는 비용.
 *
 * <p>도보 분이 바탕이고, 켠 옵션만큼 항이 붙는다. <b>대기는 그대로 더한다</b> — 기다리는 30분은
 * 걷는 30분과 같은 30분이고, 굳이 가중치를 두면 그 숫자의 근거를 댈 수 없다. 운영시간만 환산이
 * 필요해서 {@link HOURS_WEIGHT} 를 쓴다.
 */
function stepCost(
  from: { lat: number; lng: number },
  candidate: RouteStop,
  clockMinutes: number,
  options: OptimizeOptions,
): number {
  const walk = legMinutes(from, candidate);
  let cost = walk;

  if (options.useCongestion) cost += candidate.waitMinutes ?? 0;

  if (options.useHours) {
    cost += slackMinutes(from, candidate, clockMinutes, walk, options) * HOURS_WEIGHT;
  }

  return cost;
}

/**
 * 내 위치에서 시작해 가장 싼 곳을 하나씩 집어 순서를 만든다.
 *
 * <p>비용이 같으면 <b>먼저 온 것</b>이 이긴다. 동점을 남겨 두면 같은 입력이 실행마다 다른 순서를
 * 낼 수 있고, 그러면 "최적화" 버튼을 두 번 눌렀을 때 답이 바뀌어 신뢰를 잃는다.
 */
export function optimizeRoute(
  origin: { lat: number; lng: number },
  stops: RouteStop[],
  options: OptimizeOptions,
): OptimizedRoute {
  const beforeMinutes = totalWalkMinutes(origin, stops);
  if (stops.length < 2) {
    return { stops: [...stops], beforeMinutes, afterMinutes: beforeMinutes, savedMinutes: 0 };
  }

  const remaining = [...stops];
  const sorted: RouteStop[] = [];
  let from: { lat: number; lng: number } = origin;
  let clock = options.departAtMinutes ?? 0;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestCost = Infinity;

    remaining.forEach((candidate, i) => {
      const cost = stepCost(from, candidate, clock, options);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    });

    const [picked] = remaining.splice(bestIndex, 1);
    clock += legMinutes(from, picked) + (picked.waitMinutes ?? 0) + (picked.stayMinutes ?? 0);
    sorted.push(picked);
    from = picked;
  }

  const afterMinutes = totalWalkMinutes(origin, sorted);
  return {
    stops: sorted,
    beforeMinutes,
    afterMinutes,
    savedMinutes: Math.max(0, beforeMinutes - afterMinutes),
  };
}
