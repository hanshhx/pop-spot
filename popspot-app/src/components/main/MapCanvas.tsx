import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTokens } from '@/theme/ThemeProvider';

/**
 * 지도 바닥 — 시안이 그린 도로·블록·서울숲을 그대로 옮긴 것.
 *
 * <h3>왜 진짜 지도가 아닌가</h3>
 *
 * <p>웹은 MapLibre + Protomaps 로 진짜 지도를 그린다. 앱에도 같은 것을 올릴 수 있지만
 * ({@code @maplibre/maplibre-react-native}), 그건 <b>이 화면의 문제가 아니라 별개의 작업</b>이다 —
 * 네이티브 모듈이라 Expo Go 에서 안 돌고 개발 빌드가 필요하고, 타일 서버·오프라인 캐시·성능까지
 * 따라온다. 시안이 요구하는 것은 "지도 위에 핀과 하단 시트가 어떻게 앉는가" 이고, 그 배치는 이
 * 바닥으로 정확히 검증된다.
 *
 * <p>그래서 <b>바닥만 갈아 끼우면 되도록</b> 만들었다. 핀 위치는 이 컴포넌트가 정하지 않는다 —
 * 부르는 쪽이 자식으로 얹으므로, 나중에 이 파일 안을 MapLibre 로 바꿔도 핀 코드는 그대로다.
 *
 * <p>도로 색은 {@code mpl}, 바닥은 {@code mp} — 계절과 다크를 따라간다. 시안의 지도가 계절마다
 * 색이 바뀌는 이유가 그것이다.
 */

/** 시안의 뷰박스. 이 비율로 그려 놓고 화면 크기에 맞춰 늘린다. */
const VIEW_W = 392;
const VIEW_H = 460;

export function MapCanvas({ children }: { children?: React.ReactNode }) {
  const t = useTokens();

  return (
    <View style={[styles.root, { backgroundColor: t.mp }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Rect width={VIEW_W} height={VIEW_H} fill={t.mp} />

        {/* 한강 — 화면 아래를 가로지르는 물. */}
        <Path
          d="M0 358 C70 342 120 372 196 366 C270 360 320 388 392 378 L392 460 L0 460 Z"
          fill={t.sft}
          opacity={0.75}
        />

        {/* 도로. 굵기가 위계다 — 굵은 것이 큰길. */}
        <G stroke={t.mpl} fill="none">
          <Path d="M-10 120 H402" strokeWidth={13} />
          <Path d="M-10 250 H402" strokeWidth={9} />
          <Path d="M96 -10 V420" strokeWidth={11} />
          <Path d="M262 -10 V420" strokeWidth={8} />
          <Path d="M-10 60 H402M-10 182 H402M-10 310 H402" strokeWidth={3.5} />
          <Path d="M40 -10 V420M170 -10 V420M330 -10 V420" strokeWidth={3.5} />
          <Path d="M-10 20 L402 300" strokeWidth={6} opacity={0.7} />
        </G>

        {/* 건물 블록. */}
        <G fill={t.mpl} opacity={0.45}>
          <Rect x={108} y={72} width={50} height={40} rx={3} />
          <Rect x={186} y={130} width={62} height={44} rx={3} />
          <Rect x={276} y={196} width={44} height={46} rx={3} />
          <Rect x={52} y={196} width={36} height={46} rx={3} />
          <Rect x={186} y={262} width={66} height={40} rx={3} />
          <Rect x={286} y={72} width={40} height={40} rx={3} />
        </G>

        {/* 서울숲 — 이 동네에서 사람이 위치를 잡는 기준점이라 이름을 적는다. */}
        <Rect x={108} y={192} width={52} height={52} rx={6} fill="#b8d565" opacity={0.3} />
        <SvgText x={118} y={222} fontSize={9} fontWeight="700" fill={t.mu} opacity={0.8}>
          서울숲
        </SvgText>
      </Svg>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, overflow: 'hidden' },
});
