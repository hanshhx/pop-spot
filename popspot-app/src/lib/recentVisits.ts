import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 최근 본 팝업(방문 기록) — 웹 {@code src/lib/recentVisits.ts} 를 앱 저장소로 옮긴 것.
 *
 * <p>규칙은 웹과 같게 둔다. 같은 사람이 웹과 앱을 오갈 때 "본 곳" 판정이 달라지면 그게 더
 * 이상하다. 다른 것은 저장소뿐이다 — 웹은 {@code localStorage}(동기), 앱은
 * {@code AsyncStorage}(비동기).
 *
 * <p><b>서버에 보내지 않는다.</b> 무엇을 봤는지는 기기 안에만 둔다. 목록을 서버로 올리면 계정
 * 없이 쓰는 사람의 관심사를 서버가 알게 되고, 이 앱은 로그인 없이도 쓸 수 있어야 한다.
 *
 * <h3>왜 규칙과 저장을 갈라 놓았나</h3>
 *
 * <p>아래 {@code nextVisits}·{@code withoutVisit}·{@code sanitize} 는 <b>순수 함수</b>다. 웹은
 * 같은 규칙을 저장 호출 안에 섞어 두고 jsdom 으로 테스트했는데, 앱에는 jsdom 도 동기 저장소도
 * 없다. 규칙만 떼어 두면 저장소를 흉내 내지 않고도 "서른한 번째에 무엇이 사라지나" 를 그대로
 * 확인할 수 있다.
 */

const STORAGE_KEY = 'popspot:recent-visits';

/**
 * 여기서 멈춘다 — 보관 개수가 아니라 <b>안전장치</b>다.
 *
 * <p>웹 주석 그대로: 이 숫자는 "여기까지가 적당하다" 가 아니라 "여기까지 오면 무언가 잘못된
 * 것이다" 를 뜻한다. 하루에 열 개씩 봐도 일곱 주가 걸리는 자리다. 오래됐다는 이유로 기록을
 * 흘려보내지 않는다 — 지우는 쪽은 사람이 정한다({@link removeVisit} / {@link clearVisits}).
 */
export const SAFETY_LIMIT = 500;

export interface RecentVisit {
  popupId: number;
  popupName: string;
  popupImage?: string;
  /** ISO timestamp — 정렬·"언제 봤는지" 표시용({@code visitedAgo}). */
  visitedAt: string;
}

/* ------------------------------- 규칙(순수) ------------------------------- */

/**
 * 저장된 값을 믿지 않고 쓸 수 있는 것만 남긴다.
 *
 * <p>예전 판본이 다른 모양으로 넣어 두었을 수 있고, 그때 화면이 죽는 것보다 못 읽는 항목 하나를
 * 버리는 편이 낫다. {@code popupId} 가 숫자 문자열이면 숫자로 읽는다 — 옛 형식을 통째로 거부하면
 * 방문 이력이 조용히 사라지는데, 사용자가 다시 만들 수 없는 것은 잃으면 돌이킬 수 없다.
 */
export function sanitize(parsed: unknown): RecentVisit[] {
  if (!Array.isArray(parsed)) return [];
  const out: RecentVisit[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const v = row as Partial<RecentVisit>;
    const id = Number(v.popupId);
    if (!Number.isFinite(id)) continue;
    out.push({
      popupId: id,
      popupName: typeof v.popupName === 'string' ? v.popupName : '',
      popupImage: typeof v.popupImage === 'string' ? v.popupImage : undefined,
      visitedAt: typeof v.visitedAt === 'string' ? v.visitedAt : '',
    });
  }
  return out.slice(0, SAFETY_LIMIT);
}

/**
 * 이 팝업을 본 것으로 남긴 뒤의 목록.
 *
 * <p>이미 있던 팝업이면 개수를 늘리지 않고 맨 앞으로만 올린다 — 같은 곳을 두 번 봤다는 사실보다
 * 마지막으로 언제 봤는지가 화면에 필요한 정보다.
 */
export function nextVisits(
  list: RecentVisit[],
  visit: Omit<RecentVisit, 'visitedAt'>,
  now: Date = new Date(),
): RecentVisit[] {
  const filtered = list.filter((v) => v.popupId !== visit.popupId);
  return [{ ...visit, visitedAt: now.toISOString() }, ...filtered].slice(0, SAFETY_LIMIT);
}

/** 이 팝업 하나만 뺀 목록. 나머지 순서는 건드리지 않는다. */
export function withoutVisit(list: RecentVisit[], popupId: number): RecentVisit[] {
  return list.filter((v) => v.popupId !== popupId);
}

/* ------------------------------- 저장(비동기) ------------------------------ */

/**
 * 목록을 저장한다 — 한 번 튕기면 <b>오래된 절반을 버리고 한 번 더</b>.
 *
 * <p>웹 주석 그대로의 이유다. 저장소가 찬 순간부터 <b>앞으로의 기록이 영원히</b> 저장되지 않고
 * 사용자에게는 아무 신호도 가지 않는다. 가득 찬 저장소가 가져가야 할 것은 지난 기록이지 앞으로의
 * 기록이 아니다. 홀수면 새로 넣은 것이 살아남는 쪽으로 올림한다.
 */
async function writeVisits(list: RecentVisit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    try {
      const half = list.slice(0, Math.ceil(list.length / 2));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(half));
    } catch {
      // 저장소를 쓸 수 없는 환경 — 조용히 무시. 기록 때문에 화면이 죽을 이유는 없다.
    }
  }
}

/** 저장된 방문 기록을 최신순으로. */
export async function readVisits(): Promise<RecentVisit[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** 이 팝업을 본 것으로 남기고, 저장된 뒤의 목록을 돌려준다. */
export async function recordVisit(visit: Omit<RecentVisit, 'visitedAt'>): Promise<RecentVisit[]> {
  const updated = nextVisits(await readVisits(), visit);
  await writeVisits(updated);
  return updated;
}

/**
 * 이 팝업 하나만 기록에서 뺀다.
 *
 * <p>없는 id 면 <b>저장 자체를 하지 않는다.</b> 결과가 같아서가 아니라, 아무것도 바뀌지 않은
 * 호출이 쓰기를 시도했다가 실패하면 위의 재시도가 멀쩡한 목록을 절반으로 줄여 버리기 때문이다 —
 * 지우라고 한 적 없는 기록이 사라지는 길은 막아 둔다.
 */
export async function removeVisit(popupId: number): Promise<RecentVisit[]> {
  const list = await readVisits();
  const updated = withoutVisit(list, popupId);
  if (updated.length === list.length) return list;
  await writeVisits(updated);
  return updated;
}

/** 방문 기록을 통째로 비운다. */
export async function clearVisits(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 쓸 수 없는 환경 — 조용히 무시.
  }
}
