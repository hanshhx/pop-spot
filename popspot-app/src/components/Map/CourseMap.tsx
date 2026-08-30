import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { basemapTileUrl, buildBaseStyle } from './mapStyle';

/**
 * 코스 지도 — 담긴 순서대로 이은 동선을 <b>진짜 지도 위에</b> 그린다.
 *
 * <p>웹 코스 탭도 이 자리에 {@code InteractiveMap} 을 {@code showPath} 로 띄운다. 앱에는 그동안
 * {@code react-native-svg} 로 그린 <b>도식</b>이 있었다 — 좌표를 340×200 상자에 min/max 로 늘여
 * 점과 점선만 찍는 것이라 도로도 지명도 없었다. 사용자가 "코스탭에 지도가 안 뜬다" 고 한 것이
 * 그것이다. 상자는 있었지만 지도는 없었다.
 *
 * <h3>선은 점선이고, 실제 도로가 아니다</h3>
 *
 * <p>웹 코스 탭은 {@code routePaths} 를 넘기지 않아서 마커를 <b>곧게 이은 회색 점선</b>만 그린다
 * (color #666 · weight 4 · opacity .5 · dash [2,2]). 실제 도로를 따라가는 보라색 실선은 작전지도
 * ({@code /planning}) 전용이다. 여기서도 같게 둔다 — 점선은 "이 순서로 간다" 는 뜻이지 "이 길로
 * 간다" 는 뜻이 아니고, 곧은 실선으로 그리면 없는 길을 약속하게 된다.
 *
 * <p>정류장이 둘 미만이면 선을 아예 만들지 않는다. 한 점을 잇는 선은 길이가 0이라 그리는 쪽에서
 * 경고가 나고, 무엇보다 뜻이 없다.
 *
 * <h3>묶지 않는다</h3>
 *
 * <p>클러스터링을 끈다. 웹도 {@code clusterGate} 에서 {@code showPath || mode === 'PLAN'} 이면
 * 무조건 낱개로 푼다 — 코스는 대여섯 곳이고 그 하나하나가 순번을 가진다. 묶어서 "3" 이라고
 * 적어 버리면 순서가 사라진다.
 */

const SOURCE = 'course-stops';
const LINE_SOURCE = 'course-line';

/** 지도가 한 화면에 담을 때 남기는 여백(도 단위). 정류장이 화면 끝에 붙지 않게 한다. */
const FIT_MARGIN_DEG = 0.004;

/** 정류장이 하나뿐일 때의 배율. 웹 {@code easeTo({zoom: 15})} 와 같은 값. */
const SINGLE_ZOOM = 15;

export interface CourseStop {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
}

export interface CourseMapProps {
  stops: CourseStop[];
  /** 시안의 상자 높이. 웹은 모바일 280px 이다. */
  height?: number;
}

export function CourseMap({ stops, height = 280 }: CourseMapProps) {
  const { t, dark } = useTheme();

  const style = useMemo(() => buildBaseStyle(dark ? 'dark' : 'light', basemapTileUrl()), [dark]);

  /* 좌표가 없는 항목은 넘기기 전에 뺀다. 웹은 없는 좌표를 성수 기본값으로 채우는데, 그러면
     가 본 적 없는 곳이 코스 한복판에 찍힌다 — 지우는 편이 정직하다. */
  const points = useMemo(
    () =>
      stops.filter(
        (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && !(s.lat === 0 && s.lng === 0),
      ),
    [stops],
  );

  const pins = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((s, i) => ({
        type: 'Feature' as const,
        id: i,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        /* 순번을 속성으로 넣어 지도 레이어가 직접 글자를 그린다. 뷰로 그리면 코스 여섯 개마다
           네이티브 뷰가 여섯 개 붙어 지도를 움직일 때마다 다시 자리를 잡는다. */
        properties: { n: String(i + 1), name: s.name },
      })),
    }),
    [points],
  );

  const line = useMemo(() => {
    if (points.length < 2) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: points.map((s) => [s.lng, s.lat]),
          },
          properties: {},
        },
      ],
    };
  }, [points]);

  /** 전부 한 화면에 들어오는 사각형. 하나뿐이면 그 점을 중심으로 확대한다. */
  const camera = useMemo(() => {
    if (points.length === 0) return null;
    if (points.length === 1) {
      return { center: [points[0].lng, points[0].lat] as [number, number], zoom: SINGLE_ZOOM };
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return {
      bounds: [
        Math.min(...lngs) - FIT_MARGIN_DEG,
        Math.min(...lats) - FIT_MARGIN_DEG,
        Math.max(...lngs) + FIT_MARGIN_DEG,
        Math.max(...lats) + FIT_MARGIN_DEG,
      ] as [number, number, number, number],
    };
  }, [points]);

  if (!camera) return null;

  return (
    <View style={[styles.root, { height, borderColor: t.ln }]}>
      <Map mapStyle={style} style={StyleSheet.absoluteFill} attribution logo={false} compass={false}>
        <Camera initialViewState={camera} />

        {line ? (
          <GeoJSONSource id={LINE_SOURCE} data={line}>
            <Layer
              id="course-line-layer"
              type="line"
              style={{
                lineColor: '#666',
                lineWidth: 4,
                lineOpacity: 0.5,
                /* 점선이다 — "이 순서로 간다" 는 뜻이지 "이 길로 간다" 는 뜻이 아니다. */
                lineDasharray: [2, 2],
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </GeoJSONSource>
        ) : null}

        <GeoJSONSource id={SOURCE} data={pins}>
          <Layer
            id="course-stop-circle"
            type="circle"
            style={{
              circleRadius: 13,
              circleColor: t.ik,
              circleStrokeWidth: 3,
              circleStrokeColor: t.l3,
            }}
          />
          <Layer
            id="course-stop-number"
            type="symbol"
            style={{
              textField: ['get', 'n'],
              textSize: 12,
              textFont: ['Noto Sans Regular'],
              textColor: t.l3,
              /* 순번은 겹쳐도 지우지 않는다 — 하나라도 빠지면 순서를 읽을 수 없다. */
              textAllowOverlap: true,
            }}
          />
          <Layer
            id="course-stop-name"
            type="symbol"
            style={{
              textField: ['get', 'name'],
              textSize: 11,
              textFont: ['Noto Sans Regular'],
              textOffset: [0, 1.6],
              textAnchor: 'top',
              textMaxWidth: 9,
              textColor: t.ik,
              textHaloColor: t.sf,
              textHaloWidth: 1.6,
              /* 이름은 겹치면 지도가 알아서 하나를 버린다 — 순번과 달리 없어도 순서는 읽힌다. */
              textAllowOverlap: false,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
});
