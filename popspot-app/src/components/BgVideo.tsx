import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";

import { BG_VIDEO_URL } from "../api";
import { colors } from "../theme";

/**
 * 전역 배경 영상 — 웹과 동일한 light-bg 를 스트리밍(700KB, CORS 허용). 무음·루프.
 * 위에 얕은 스크림을 깔아 글라스 카드/텍스트 가독성을 확보한다.
 */
export default function BgVideo() {
  const player = useVideoPlayer(BG_VIDEO_URL, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
    </View>
  );
}
