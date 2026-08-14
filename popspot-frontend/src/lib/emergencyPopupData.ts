import snapshotJson from '@/data/emergency/popups-2026-08-11.json';
import snapshotMeta from '@/data/emergency/popups-2026-08-11.meta.json';
import { isExpired, isStale, kstTodayStart } from '@/lib/popupSlices';
import type { PublicMapMarker } from '@/lib/mapMarkers';
import type { PopupStore } from '@/types/popup';

export type EmergencyMarker = PublicMapMarker & {
  lastModified?: string | null;
};

export type PublicMarkerLoad = {
  markers: EmergencyMarker[];
  source: 'live' | 'snapshot';
  capturedAt?: string;
};

/**
 * 2026-08-12 운영 정리 때 목록에서 숨긴 ID다. 상세 주소는 검색 결과와 기존 링크를
 * 보존해야 하므로 삭제하지 않고, 스냅샷 목록·사이트맵·RSS에서만 제외한다.
 */
const HIDDEN_DUPLICATE_IDS = new Set([
  525, 573, 575, 577, 581, 596, 600, 638, 1996, 1997, 2340, 2626, 1702, 1717, 1729, 1899, 2035,
  2195, 756, 1820, 1972, 2709, 3225, 3288, 3532, 1891, 3129, 3454, 1444, 2806, 3059, 2857, 3112,
  3272, 3013, 3615, 1180, 1605, 594, 1316, 3017, 2733, 2824, 3461, 2402, 3218, 2375, 3009, 3449,
  3062, 3242, 3179, 3596, 3363, 656, 3391, 1468, 3282, 715, 1172, 2058,
]);

const snapshot = snapshotJson as EmergencyMarker[];

export const EMERGENCY_SNAPSHOT_META = snapshotMeta;

function validMarker(value: unknown): value is EmergencyMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<EmergencyMarker>;
  return Number.isInteger(marker.id) && marker.id! > 0 && typeof marker.name === 'string';
}

function normalizedLiveMarkers(value: unknown): EmergencyMarker[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(validMarker)) return null;
  return value;
}

export function allEmergencyMarkers(): EmergencyMarker[] {
  return snapshot;
}

export function findEmergencyMarker(id: string | number): EmergencyMarker | null {
  const numericId = typeof id === 'number' ? id : Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  return snapshot.find((marker) => marker.id === numericId) ?? null;
}

export function isEmergencyDuplicate(id: number): boolean {
  return HIDDEN_DUPLICATE_IDS.has(id);
}

/**
 * 비상 목록용 자료다. 상세 ID 949개는 모두 보존하되 목록에서는 당시 숨긴 중복과
 * 현재 한국 날짜 기준으로 끝난 행을 제외한다. 날짜가 없다는 이유로 임의 마감시키지는 않는다.
 */
export function activeEmergencyMarkers(today = kstTodayStart()): EmergencyMarker[] {
  return snapshot.filter(
    (marker) =>
      !HIDDEN_DUPLICATE_IDS.has(marker.id) &&
      !isExpired(marker.endDate, today) &&
      !isStale(marker.startDate, marker.endDate, today),
  );
}

/**
 * 정상 응답(또는 Next가 보관한 기존 성공 응답)을 먼저 사용하고, 접속 실패·5xx·깨진 응답일 때만
 * 저장소 스냅샷을 쓴다. 정상 서버가 빈 목록을 반환하는 경우도 데이터 손상으로 보고 비상 자료를 쓴다.
 */
export async function loadPublicMarkers(revalidate = 3600): Promise<PublicMarkerLoad> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (apiBase && /^https?:\/\//.test(apiBase)) {
    try {
      const response = await fetch(`${apiBase}/api/map/markers`, { next: { revalidate } });
      if (response.ok) {
        const live = normalizedLiveMarkers(await response.json());
        if (live) return { markers: live, source: 'live' };
      }
    } catch {
      // 아래의 검증된 공개 스냅샷으로 이어진다.
    }
  }

  return {
    markers: activeEmergencyMarkers(),
    source: 'snapshot',
    capturedAt: snapshotMeta.capturedAt,
  };
}

export function emergencyMarkerToPopup(marker: EmergencyMarker): PopupStore {
  return {
    id: marker.id,
    name: marker.name,
    nameEn: marker.nameEn,
    nameJa: marker.nameJa,
    location: marker.location ?? '',
    locationEn: marker.locationEn,
    locationJa: marker.locationJa,
    status: 'SNAPSHOT',
    viewCount: 0,
    latitude: marker.latitude ?? undefined,
    longitude: marker.longitude ?? undefined,
    category: marker.category ?? undefined,
    startDate: marker.startDate ?? undefined,
    endDate: marker.endDate ?? undefined,
    description: '',
  };
}

export function assertEmergencySnapshot(): void {
  if (snapshot.length !== snapshotMeta.itemCount || !snapshot.every(validMarker)) {
    throw new Error('비상 팝업 스냅샷의 항목 수 또는 필드가 메타데이터와 다릅니다.');
  }
  if (new Set(snapshot.map((marker) => marker.id)).size !== snapshot.length) {
    throw new Error('비상 팝업 스냅샷에 중복 ID가 있습니다.');
  }
}

assertEmergencySnapshot();
