/**
 * 한 번 알아낸 팝업의 이름·사진·기간을 이 브라우저에 적어 둔다.
 *
 * <p><b>왜 필요한가 — 상세 조회는 공짜가 아니다.</b> 저장 목록이 끝난 팝업의 이름을 알아내려고
 * {@code GET /api/popups/{id}} 를 부르는데, 그 엔드포인트는 <b>읽기가 아니라 쓰기</b>다.
 * 컨트롤러 주석이 직접 그렇게 적어 두었다:
 *
 * <blockquote>상세. 진입할 때마다 조회수를 1 올리는 부수효과가 있어 캐시 헤더를 붙이지 않는다 —
 * 캐시에 걸리면 조회수가 멈추고, 그 값이 인기 정렬의 기준이라 랭킹 자체가 고장난다.</blockquote>
 *
 * <p>즉 한 번 부를 때마다 {@code viewCount} UPDATE 한 번과 YouTube 검색 한 번이 나간다. 그런데
 * 저장 목록은 <b>MY 탭에 들어갈 때마다</b> 다시 그려진다 — 탭을 오갈 때마다, 언어를 바꿀 때마다,
 * "다시 시도" 를 누를 때마다 담아 둔 개수만큼. 아무도 보지 않은 팝업의 조회수가 오르고,
 * 인프라 비용이 0원이어야 하는 서비스에서 카드 한 장 그리자고 외부 API 를 태운다.
 *
 * <p><b>고치는 방향.</b> 화면을 그리는 데 필요한 것은 이름·사진·위치·기간뿐이고, 그건 <b>변하지
 * 않는 값</b>이다(이미 끝난 팝업이면 더욱). 한 번 알아냈으면 적어 두고 다시 묻지 않는다.
 *
 * <p><b>왜 sessionStorage 가 아닌가.</b> 탭을 닫으면 사라지면 다음 방문에서 같은 요청이 다시
 * 나간다. 이 값은 그 브라우저에 오래 남아 있을수록 좋다 — 비밀도 아니고 개인정보도 아니다.
 *
 * <p><b>이걸로 0 이 되지는 않는다.</b> 예전에 담아 둔 팝업은 아직 적어 둔 것이 없어 처음 한 번은
 * 물어봐야 한다. 다만 <b>영영 한 번</b>이 된다. 완전히 없애려면 담는 순간에 함께 적어 두거나
 * (담기 화면은 이미 그 값을 들고 있다) 부수효과 없는 조회 경로가 백엔드에 있어야 한다.
 */

import type { PopupStore } from '@/types/popup';

export const POPUP_SUMMARY_CACHE_KEY = 'popspot:popup-summary';

/**
 * 적어 둘 수 있는 최대 개수. 비회원 찜 상한({@code GUEST_WISHLIST_MAX})과 같다 — 그보다 많이
 * 들고 있을 이유가 없다. 넘으면 <b>오래된 것부터</b> 버린다.
 */
const MAX_ENTRIES = 100;

/**
 * 적어 둔 값의 수명 — 30일.
 *
 * <p>끝난 팝업의 이름과 기간은 변하지 않으므로 사실 만료가 필요 없다. 그래도 두는 이유는
 * <b>고쳐진 자료를 언젠가는 다시 읽기 위해서</b>다 — 크롤러가 잘못 넣은 이름이나 좌표가
 * 나중에 고쳐지는 일이 실제로 있다(이 저장소의 "서울" 접두사 사고).
 */
const TTL_MS = 30 * 24 * 60 * 60_000;

export interface PopupSummary {
  id: number;
  name: string;
  imageUrl: string;
  location: string;
  startDate: string;
  endDate: string;
  savedAt: number;
}

/** 상세 응답에서 화면에 필요한 것만 뽑는다. */
export function toSummary(popup: PopupStore, now: number): PopupSummary {
  return {
    id: Number(popup.id),
    name: popup.name,
    imageUrl: popup.imageUrl ?? '',
    location: popup.location ?? '',
    startDate: popup.startDate ?? '',
    endDate: popup.endDate ?? '',
    savedAt: now,
  };
}

/** 적어 둔 것을 전부 읽는다. 형식이 틀렸거나 낡은 것은 버린다. */
export function readSummaries(now: number): Map<number, PopupSummary> {
  const out = new Map<number, PopupSummary>();
  if (typeof window === 'undefined') return out;
  let raw: unknown;
  try {
    raw = JSON.parse(window.localStorage.getItem(POPUP_SUMMARY_CACHE_KEY) ?? 'null');
  } catch {
    return out;
  }
  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    const summary = resolveSummary(entry, now);
    if (summary) out.set(summary.id, summary);
  }
  return out;
}

/**
 * 새로 알아낸 것을 더한다. 이미 있으면 갈아 끼운다.
 *
 * <p>쓰기가 실패해도 알리지 않는다 — 못 적으면 다음에 다시 물어볼 뿐, 화면은 정상이다.
 */
export function rememberSummaries(summaries: readonly PopupSummary[], now: number): void {
  if (typeof window === 'undefined' || summaries.length === 0) return;
  const merged = readSummaries(now);
  for (const s of summaries) merged.set(s.id, s);
  // 오래된 것부터 버린다 — 최근에 알아낸 것일수록 지금 화면에 있을 가능성이 높다.
  const kept = [...merged.values()].sort((a, b) => a.savedAt - b.savedAt).slice(-MAX_ENTRIES);
  try {
    window.localStorage.setItem(POPUP_SUMMARY_CACHE_KEY, JSON.stringify(kept));
  } catch {
    /* 저장소가 막혔다. 다음에 다시 묻는다. */
  }
}

/**
 * 적어 둔 항목 하나를 믿어도 되는지 판단한다. 순수 함수 — 브라우저 없이 시험한다.
 *
 * <p>localStorage 값은 무엇이든 들어올 수 있다고 본다(사용자가 고칠 수 있고, 과거 버전이 다른
 * 모양으로 남겼을 수도 있다). {@code guestWishlist.ts} 와 같은 태도다.
 */
export function resolveSummary(raw: unknown, now: number): PopupSummary | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Number.isInteger(r.id) || (r.id as number) <= 0) return null;
  if (typeof r.name !== 'string' || r.name === '') return null;
  const savedAt = typeof r.savedAt === 'number' ? r.savedAt : 0;
  if (savedAt > now || now - savedAt > TTL_MS) return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: r.id as number,
    name: r.name,
    imageUrl: str(r.imageUrl),
    location: str(r.location),
    startDate: str(r.startDate),
    endDate: str(r.endDate),
    savedAt,
  };
}

/** 적어 둔 것을 전부 버린다. */
export function clearSummaries(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(POPUP_SUMMARY_CACHE_KEY);
  } catch {
    /* 못 지워도 TTL 이 끝낸다. */
  }
}
