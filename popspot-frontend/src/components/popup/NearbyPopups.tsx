'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { loadMapMarkers } from '@/lib/mapMarkers';
import { findNearby, walkingMinutes, type NearbyPopup } from '@/lib/nearbyPopups';
import { localizedPath } from '@/lib/localePath';
import { useLocale, type Locale } from '@/lib/i18n';

/**
 * 지금 보고 있는 팝업 근처의 다른 팝업.
 *
 * <p>성수까지 가서 하나만 보고 오는 사람은 없다. 그런데 상세 페이지는 그 팝업 하나로 끝나서,
 * 근처에 뭐가 더 있는지 보려면 지도로 되돌아가 다시 찾아야 했다.
 *
 * <p>백엔드를 건드리지 않는다. 좌표는 모든 팝업이 이미 갖고 있고, 목록은
 * {@link loadMapMarkers} 가 세션 캐시(5분)로 들고 있다 — 이 화면 때문에 요청이 한 번 더
 * 나가는 일은 대개 없다.
 */

/**
 * "도보 4분" 은 언어마다 어순이 달라 사전에 넣을 수 없다({@code t()} 는 값을 못 받는다).
 * 랜딩이 {@code LandingCopy} 로 같은 문제를 푼 방식을 따른다.
 */
function walkLabel(minutes: number, locale: Locale): string {
  if (locale === 'en') return `${minutes} min walk`;
  if (locale === 'ja') return `徒歩${minutes}分`;
  return `도보 ${minutes}분`;
}

/** 직선 거리라는 사실을 숨기지 않는다 — 실제로 걷는 길은 이것보다 멀다. */
function distanceLabel(km: number, locale: Locale): string {
  const meters = Math.round(km * 1000);
  if (meters < 1000) return `${meters}m`;
  const rounded = (Math.round(km * 10) / 10).toFixed(1);
  return locale === 'ja' ? `${rounded}km` : `${rounded}km`;
}

interface NearbyPopupsProps {
  /** 지금 보고 있는 팝업. 목록에서 자기 자신을 뺀다. */
  popupId: number;
  /** 같은 행사가 다른 id 로 또 들어와 있는 경우가 있어 이름으로도 뺀다. */
  popupName: string;
  latitude: number;
  longitude: number;
}

export default function NearbyPopups({
  popupId,
  popupName,
  latitude,
  longitude,
}: NearbyPopupsProps) {
  const { t, locale } = useLocale();
  const [nearby, setNearby] = useState<NearbyPopup[] | null>(null);

  useEffect(() => {
    // 좌표가 없는 팝업이 있다. 그런 팝업에는 이 화면 자체가 성립하지 않는다.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setNearby([]);
      return;
    }

    let alive = true;
    loadMapMarkers()
      .then((markers) => {
        if (!alive) return;
        // 날짜 판정은 KST 로 한다. 브라우저 시간대가 무엇이든 마감일은 한국 날짜다.
        const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        setNearby(
          findNearby({ lat: latitude, lng: longitude }, markers, {
            excludeId: popupId,
            excludeName: popupName,
            today,
          }),
        );
      })
      // 목록을 못 받는 것은 이 팝업을 보는 데 지장이 없다. 조용히 접는다.
      .catch(() => alive && setNearby([]));

    return () => {
      alive = false;
    };
  }, [popupId, popupName, latitude, longitude]);

  // 불러오는 중이거나 근처에 아무것도 없으면 자리를 만들지 않는다. 빈 칸이 있는 화면은
  // 원래 화면보다 나쁘다 — "근처에 아무것도 없습니다" 는 알려 줄 가치가 없는 사실이다.
  if (!nearby || nearby.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-black">{t('detail.nearbyTitle')}</h2>
      <ul className="flex flex-col gap-2">
        {nearby.map(({ marker, distanceKm: km }) => {
          const name =
            (locale === 'en' ? marker.nameEn : locale === 'ja' ? marker.nameJa : null) ||
            marker.name;
          const place =
            (locale === 'en' ? marker.locationEn : locale === 'ja' ? marker.locationJa : null) ||
            marker.location;
          return (
            <li key={marker.id}>
              <Link
                href={localizedPath(`/popup/${marker.id}`, locale)}
                className="card-lift flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">{name}</span>
                  {place && (
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin size={12} className="shrink-0" aria-hidden />
                      {place}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold text-foreground">
                    {distanceLabel(km, locale)}
                  </span>
                  <span className="block text-[11px] text-subtle-foreground">
                    {walkLabel(walkingMinutes(km), locale)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
