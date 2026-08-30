import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { classifyCategory, categoryLabel } from '@/lib/popupSlices';
import { popupCoverUrl } from '@/lib/popupCover';
import { useTheme } from '@/theme/ThemeProvider';
import type { PopupStore } from '@/types/popup';
import { categoryIcon, categoryLabelColor } from './categoryVisual';
import { popupBadgeVisual } from './popupBadgeStyle';

/**
 * 목록의 한 칸 — 전체보기·음악·찜에서 같은 모양을 쓴다.
 *
 * <p>웹의 {@code PopupCard} 와 같은 자리다. 카드를 화면마다 새로 그리면 <b>반드시 갈라진다</b> —
 * 웹에서 카테고리 색이 카드 파일 안에만 있다가 두 번째 화면이 생기며 복사됐고, 그래서
 * {@code categoryVisual.ts} 가 따로 생겼다. 그 교훈을 처음부터 적용한다.
 */

export interface PopupCardProps {
  popup: PopupStore;
  today: Date;
  onPress: () => void;
  /** 이미 본 곳은 흐리게. 시안 전체보기의 "본 곳" 표시. */
  seen?: boolean;
  style?: ViewStyle;
}

export function PopupCard({ popup, today, onPress, seen = false, style }: PopupCardProps) {
  const { t } = useTheme();
  const cover = popupCoverUrl(popup);
  const badge = popupBadgeVisual(popup.startDate, popup.endDate, today, t);
  const code = classifyCategory(popup.category);
  const { color, tint } = categoryLabelColor(code);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: t.sf, borderColor: t.ln, opacity: seen ? 0.62 : 1 },
        style,
      ]}
    >
      <View style={[styles.image, { backgroundColor: t.mp }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          /* 사진이 없을 때 잘못된 사진을 붙이는 대신 의도된 빈자리로 보이게 한다. */
          <View style={styles.noPhoto}>
            <Icon name={categoryIcon(code)} size={22} color={t.mu} opacity={0.45} />
          </View>
        )}

        {/* 시안은 사흘 이내에만 배지를 단다 — 모두에게 주는 배지는 신호가 아니라 배경이다. */}
        {badge?.urgent ? (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <T size={9.5} weight={700} color={badge.fg}>
              {badge.label}
            </T>
          </View>
        ) : null}

        {seen ? (
          <View style={styles.seen}>
            <T size={9} weight={700} color="#fff">
              본 곳
            </T>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <T size={12} weight={700} numberOfLines={1}>
          {popup.name}
        </T>
        {popup.nameEn ? (
          <T size={9.5} color={t.mu} dim={0.5} numberOfLines={1}>
            {popup.nameEn}
          </T>
        ) : null}
        <View style={styles.meta}>
          <Icon name="pin" size={10} color={t.mu} strokeWidth={2.4} />
          <T size={10.5} color={t.mu} dim={0.8} numberOfLines={1}>
            {popup.location}
          </T>
        </View>
        <View style={[styles.catChip, { backgroundColor: tint }]}>
          <T size={9.5} weight={700} color={color ?? t.ik}>
            {categoryLabel(code)}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  image: { aspectRatio: 4 / 5 },
  noPhoto: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  seen: {
    position: 'absolute',
    right: 8,
    top: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,.6)',
  },
  body: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 11, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  catChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 1,
  },
});
