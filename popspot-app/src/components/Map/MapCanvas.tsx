import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_LABEL_COLOR } from '@/components/main/categoryVisual';
import { classifyCategory } from '@/lib/popupSlices';
import { useTheme } from '@/theme/ThemeProvider';
import type { PopupStore } from '@/types/popup';
import { basemapTileUrl, buildBaseStyle } from './mapStyle';

/**
 * 지도 — MapLibre 로 진짜 지도를 그린다. 웹과 같은 타일, 같은 스타일.
 *
 * <p>타일은 {@code popspot.co.kr/seoul.pmtiles}(59MB, Protomaps basemap v4)를 그대로 쓴다. 웹이
 * 브라우저 pmtiles 프로토콜로 읽는 그 파일이고, MapLibre Native 는 {@code pmtiles://} 를 <b>네이티브로
 * 지원</b>한다(Android 11.7.0+ / iOS 6.10.0+). 그래서 타일 서버를 새로 세울 필요가 없고 비용도 그대로 0원이다.
 *
 * <p>스타일은 {@code mapStyle.ts} — 웹에서 그대로 옮겼다. 그 파일에서 웹과 다른 곳은 타입 import 와
 * {@code window.location.origin} 을 {@code API_BASE_URL} 로 바꾼 두 줄뿐이다.
 *
 * <h3>핀을 뷰로 그리지 않는다</h3>
 *
 * <p>지금 열려 있는 팝업이 <b>1,268곳</b>이다. 그만큼의 {@code <Marker>} 는 각각이 네이티브 뷰라
 * 지도를 한 번 움직일 때마다 전부 다시 자리를 잡는다 — 스크롤이 멈춘다. 그래서 좌표는 GeoJSON 한
 * 덩어리로 넘기고 원·글자는 <b>지도 레이어</b>가 GPU 에서 그린다. 내 위치처럼 하나뿐인 것만 뷰로 둔다.
 *
 * <p>이름표는 확대해야 나온다({@code minzoom}). 서울 전체가 보이는 배율에서 1,268개의 이름을 그리면
 * 서로 겹쳐 아무것도 안 읽힌다 — 지도가 스스로 겹침을 피해 주지만, 그 결과는 "이름이 랜덤하게 몇 개만
 * 보이는" 화면이라 차라리 원만 두는 편이 낫다.
 */

/** 팝업 원을 그리는 레이어 id. 탭 판정에도 쓴다. */
const PIN_LAYER = 'popspot-pins';
const LABEL_LAYER = 'popspot-pin-labels';
const CLUSTER_LAYER = 'popspot-clusters';
const CLUSTER_COUNT_LAYER = 'popspot-cluster-count';
const SOURCE = 'popspot-popups';

/** 이름표가 나오기 시작하는 배율. 이보다 멀면 원만 보인다. */
const LABEL_MIN_ZOOM = 14;

export interface MapCanvasProps {
  /** 지도에 찍을 팝업. 좌표가 없는 것은 알아서 빠진다. */
  popups: PopupStore[];
  /** 내 위치. 없으면 점을 그리지 않는다. */
  me?: { lat: number; lng: number } | null;
  /** 처음 볼 자리. 이후 사용자가 움직인 것은 건드리지 않는다. */
  center: { lat: number; lng: number };
  zoom?: number;
  onPressPopup?: (id: number) => void;
  /** 지도 위에 겹쳐 놓을 것(다시 검색 버튼·내 위치 버튼 등). */
  children?: React.ReactNode;
}

export function MapCanvas({
  popups,
  me,
  center,
  zoom = 13,
  onPressPopup,
  children,
}: MapCanvasProps) {
  const { t, dark } = useTheme();

  /* 스타일은 명암이 바뀔 때만 다시 만든다 — 매 렌더마다 새 객체를 넘기면 지도가 통째로 다시 그려진다. */
  const style = useMemo(() => buildBaseStyle(dark ? 'dark' : 'light', basemapTileUrl()), [dark]);

  const collection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: popups.flatMap((p) => {
        const lat = Number(String(p.latitude ?? '').trim());
        const lng = Number(String(p.longitude ?? '').trim());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
        if (lat === 0 && lng === 0) return [];
        return [
          {
            type: 'Feature' as const,
            id: p.id,
            geometry: { type: 'Point' as const, coordinates: [lng, lat] },
            properties: { id: p.id, name: p.name, cat: classifyCategory(p.category) },
          },
        ];
      }),
    }),
    [popups],
  );

  /**
   * 분야 → 원 색. 목록 이름 색과 <b>같은 표</b>를 쓴다({@code CATEGORY_LABEL_COLOR}) — 그래야
   * 목록에서 본 색과 지도에서 본 색이 저절로 맞는다.
   */
  const circleColor = useMemo(() => {
    const pairs = Object.entries(CATEGORY_LABEL_COLOR).flatMap(([code, v]) => [code, v.color]);
    return ['match', ['get', 'cat'], ...pairs, t.ik] as unknown as string;
  }, [t.ik]);

  const onPress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const id = event.nativeEvent.features?.[0]?.properties?.id;
    if (typeof id === 'number') onPressPopup?.(id);
  };

  return (
    <View style={styles.root}>
      {/* attribution 은 켜 둔다 — OpenStreetMap 기여자 표기는 타일 라이선스 의무다. */}
      <Map mapStyle={style} style={StyleSheet.absoluteFill} attribution logo={false} compass={false}>
        <Camera initialViewState={{ center: [center.lng, center.lat], zoom }} />

        <GeoJSONSource
          id={SOURCE}
          data={collection}
          onPress={onPress}
          /* 서울 전체가 보이는 배율에서 1,268개를 낱개로 찍으면 성수 일대가 색 덩어리가 된다.
             지도가 묶어서 개수로 보여 주고, 확대하면 풀린다. */
          cluster
          clusterRadius={48}
          clusterMaxZoom={13}
        >
          <Layer
            id={CLUSTER_LAYER}
            type="circle"
            filter={['has', 'point_count']}
            style={{
              circleRadius: ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
              circleColor: t.ik,
              circleStrokeWidth: 3,
              circleStrokeColor: t.l3,
            }}
          />
          <Layer
            id={CLUSTER_COUNT_LAYER}
            type="symbol"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'],
              textSize: 12,
              textFont: ['Noto Sans Regular'],
              textColor: t.l3,
            }}
          />
          <Layer
            id={PIN_LAYER}
            type="circle"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6, 17, 9],
              circleColor,
              circleStrokeWidth: 2,
              circleStrokeColor: t.sf,
              circleOpacity: 0.95,
            }}
          />
          <Layer
            id={LABEL_LAYER}
            type="symbol"
            minzoom={LABEL_MIN_ZOOM}
            filter={['!', ['has', 'point_count']]}
            style={{
              textField: ['get', 'name'],
              textSize: 11,
              textFont: ['Noto Sans Regular'],
              textOffset: [0, 1.1],
              textAnchor: 'top',
              textMaxWidth: 8,
              textColor: t.ik,
              textHaloColor: t.sf,
              textHaloWidth: 1.6,
              /* 겹치면 지도가 알아서 하나만 남긴다. 지우는 대신 밀어내지 않는 이유는, 밀어내면
                 이름이 실제 위치에서 멀어져 어느 원의 이름인지 알 수 없기 때문이다. */
              textAllowOverlap: false,
            }}
          />
        </GeoJSONSource>

        {/* 내 위치는 하나뿐이라 뷰로 그린다 — 파랑은 지도 색과 절대 겹치지 않아 고정값이다. */}
        {me ? (
          <Marker lngLat={[me.lng, me.lat]}>
            <View style={styles.me} />
          </Marker>
        ) : null}
      </Map>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, overflow: 'hidden' },
  me: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00a6c4',
    borderWidth: 3,
    borderColor: '#fff',
  },
});
