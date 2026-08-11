import { apiFetch } from './api';

export interface PublicMapMarker {
  id: number;
  name: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  nameEn?: string | null;
  nameJa?: string | null;
  locationEn?: string | null;
  locationJa?: string | null;
}

const SESSION_CACHE_KEY = 'popspot:map-markers:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedMarkers = { savedAt: number; markers: PublicMapMarker[] };

let memoryCache: CachedMarkers | null = null;
let requestInFlight: Promise<PublicMapMarker[]> | null = null;

function isMarker(value: unknown): value is PublicMapMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<PublicMapMarker>;
  return typeof marker.id === 'number' && typeof marker.name === 'string';
}

function fresh(cache: CachedMarkers | null, now = Date.now()): cache is CachedMarkers {
  return !!cache && now - cache.savedAt < CACHE_TTL_MS && cache.markers.length > 0;
}

function readSessionCache(): CachedMarkers | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedMarkers>;
    if (
      typeof parsed.savedAt !== 'number' ||
      !Array.isArray(parsed.markers) ||
      !parsed.markers.every(isMarker)
    ) {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return { savedAt: parsed.savedAt, markers: parsed.markers };
  } catch {
    return null;
  }
}

function saveCache(markers: PublicMapMarker[]): void {
  const value = { savedAt: Date.now(), markers };
  memoryCache = value;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(value));
  } catch {
    // 사생활 보호 모드·저장공간 부족이어도 메모리 캐시와 현재 화면은 정상 동작한다.
  }
}

/**
 * 지도와 BROWSE가 함께 쓰는 공개 마커 목록.
 *
 * <p>예전에는 두 컴포넌트가 같은 355KB 응답을 각각 요청하고 JSON 도 두 번 풀었다. 이제 첫 호출의
 * Promise 자체를 공유하고, 탭 안에서는 5분 캐시를 사용한다. 일반 새로고침 뒤에도 sessionStorage가
 * 먼저 핀을 복원하므로 순간적인 네트워크 장애가 빈 지도로 굳지 않는다.
 */
export async function loadMapMarkers(): Promise<PublicMapMarker[]> {
  if (fresh(memoryCache)) return memoryCache.markers;

  const stored = readSessionCache();
  if (fresh(stored)) {
    memoryCache = stored;
    return stored.markers;
  }

  if (!requestInFlight) {
    requestInFlight = apiFetch('/api/map/markers')
      .then(async (response) => {
        if (!response.ok) throw new Error(`map markers ${response.status}`);
        const body: unknown = await response.json();
        if (!Array.isArray(body) || !body.every(isMarker)) {
          throw new Error('map markers invalid response');
        }
        saveCache(body);
        return body;
      })
      .catch((error) => {
        // 5분이 지난 캐시라도 날짜 필터를 다시 거쳐 그리는 편이 빈 지도보다 낫다. 네트워크가 돌아오면
        // 다음 호출에서 다시 최신화를 시도하며, 실패한 캐시를 새것처럼 저장해 수명을 늘리지는 않는다.
        const stale = memoryCache ?? stored;
        if (stale?.markers.length) return stale.markers;
        throw error;
      })
      .finally(() => {
        requestInFlight = null;
      });
  }

  return requestInFlight;
}

/** 테스트에서 모듈 전역 캐시가 다른 사례로 새지 않게 비운다. */
export function resetMapMarkerCacheForTest(): void {
  memoryCache = null;
  requestInFlight = null;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY);
    } catch {
      // 저장소 접근이 차단된 환경에서도 메모리 캐시는 정상적으로 초기화한다.
    }
  }
}
