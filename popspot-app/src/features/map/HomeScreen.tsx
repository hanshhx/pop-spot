import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { Wordmark } from '@/components/layout/Wordmark';
import { MapCanvas } from '@/components/main/MapCanvas';
import { categoryLabelColor } from '@/components/main/categoryVisual';
import { popupBadgeVisual } from '@/components/main/popupBadgeStyle';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { openPopups, usePopups } from '@/features/popup/usePopups';
import { useMyLocation } from './useMyLocation';
import { SEASON_COPY } from '@/lib/season';
import { classifyCategory, kstTodayStart, CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { popupCoverUrl } from '@/lib/popupCover';
import { unreadCount, useNotifyStore } from '@/store/useNotifyStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { PopupStore } from '@/types/popup';
import type { RootStackParamList } from '@/types/navigation';
import { boundsOf, placePins } from './project';

/**
 * 홈 · 지도 — 시안 06.
 *
 * <p>웹 홈의 지도 탭 구조를 그대로 옮겼다: 검색 필 → 카테고리 칩 → 지도 → 하단 시트. 핀 색은
 * {@code CATEGORY_LABEL_COLOR} 를 쓴다 — 웹의 목록 이름 색과 같은 표라, 목록에서 본 색과 지도에서
 * 본 색이 저절로 맞는다.
 *
 * <p>시안이 카테고리 곳수를 121·42·28 처럼 적어 둔 자리는 <b>실제로 센다.</b> 목록이 통째로
 * 메모리에 있어서 셀 수 있고({@code usePopups} 주석), 세지 않고 적어 두면 그 숫자는 하루 만에
 * 거짓이 된다.
 */

/** 지도 위 핀에 이름표를 다는 최대 개수. 그 이상이면 이름표가 서로 겹쳐 읽히지 않는다. */
const LABELLED_PINS = 12;

/** 이름표 폭. 이 값의 절반만큼 왼쪽으로 당겨야 핀이 좌표 위에 온다. */
const PIN_WIDTH = 132;

/** 내 위치를 핀과 같은 방식으로 투영하기 위한 껍데기. 화면에 이름으로 나오지 않는다. */
const MY_MARKER = { id: -1, name: '내 위치', location: '', status: '', viewCount: 0 } as const;

export default function HomeScreen() {
  const { t, season } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { popups, source, loading, reload } = usePopups();
  const me = useMyLocation();
  const [category, setCategory] = useState<CategoryCode | null>(null);
  const unread = unreadCount(useNotifyStore((s) => s.inbox));

  const today = useMemo(() => kstTodayStart(), []);
  const open = useMemo(() => openPopups(popups, today), [popups, today]);

  /** 칩에 붙는 곳수. 전체는 지금 열려 있는 것 전부. */
  const counts = useMemo(() => {
    const map = new Map<CategoryCode, number>();
    for (const p of open) {
      const code = classifyCategory(p.category);
      map.set(code, (map.get(code) ?? 0) + 1);
    }
    return map;
  }, [open]);

  const shown = useMemo(
    () => (category ? open.filter((p) => classifyCategory(p.category) === category) : open),
    [open, category],
  );

  const bounds = useMemo(() => boundsOf(shown), [shown]);
  const pins = useMemo(() => placePins(shown, bounds), [shown, bounds]);

  /* 내 위치도 핀과 같은 상자에 얹는다. 시안은 화면 가운데 아래(50%,64%)에 고정해 두었는데,
     그러면 지도를 어디로 옮기든 내가 늘 같은 자리에 있는 것처럼 보인다. */
  const mePoint = useMemo(
    () => placePins([{ ...MY_MARKER, latitude: String(me.lat), longitude: String(me.lng) }], bounds)[0],
    [bounds, me.lat, me.lng],
  );

  /* 계절 배지 — 계절을 고르지 않았으면 브랜드다. 시안 홈 왼쪽 위의 작은 라벨. */
  const seasonTag = season === 'brand' ? 'BRAND' : SEASON_COPY[season].upper;

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.head, { backgroundColor: t.bg, paddingTop: insets.top + 8 }]}>
        <View style={styles.headRow}>
          <Wordmark height={22} />
          <View style={[styles.seasonTag, { backgroundColor: t.sft }]}>
            <T size={9} weight={700} color={t.l7} numeric>
              {seasonTag}
            </T>
          </View>
          <View style={styles.grow} />

          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel={unread > 0 ? `알림 ${unread}건` : '알림'}
            style={[styles.roundBtn, { backgroundColor: t.sf, borderColor: t.ln }]}
          >
            <Icon name="bell" size={17} color={t.ik} />
            {/* 시안은 배지에 3을 박아 두었다. 실제 안 읽은 개수를 센다 — 없으면 배지도 없다. */}
            {unread > 0 ? (
              <View style={[styles.bellBadge, { backgroundColor: t.ac }]}>
                <T size={9} weight={700} color="#fff" numeric>
                  {unread > 9 ? '9+' : unread}
                </T>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('My')}
            accessibilityLabel="마이페이지"
            style={[styles.avatar, { borderColor: t.ln, backgroundColor: t.mp }]}
          >
            <Icon name="user" size={18} color={t.mu} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Search')}
          accessibilityRole="search"
          style={[styles.searchPill, { backgroundColor: t.sf, borderColor: t.ln }]}
        >
          <Icon name="search" size={16} color={t.mu} strokeWidth={2.2} />
          <T size={13.5} color={t.mu} dim={0.75} style={styles.grow}>
            성수 팝업 · 브랜드 · 무드로 검색
          </T>
          <View style={[styles.searchGo, { backgroundColor: t.l3 }]}>
            <Icon name="arrowRight" size={15} color={t.hif} strokeWidth={2.4} />
          </View>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label="전체"
            count={loading && popups.length === 0 ? undefined : open.length}
            on={category === null}
            onPress={() => setCategory(null)}
          />
          {CATEGORIES.filter((c) => (counts.get(c.code) ?? 0) > 0).map((c) => (
            <Chip
              key={c.code}
              label={c.label}
              count={counts.get(c.code)}
              on={category === c.code}
              onPress={() => setCategory(c.code)}
            />
          ))}
        </ScrollView>
      </View>

      <MapCanvas>
        {pins.slice(0, LABELLED_PINS).map(({ popup, x, y }) => {
          /* 모르는 분야는 색이 없다 — 지어내지 않고 본문색으로 그린다(categoryVisual 주석). */
          const color = categoryLabelColor(classifyCategory(popup.category)).color ?? t.ik;
          return (
            <Pressable
              key={popup.id}
              onPress={() => navigation.navigate('Detail', { id: popup.id })}
              style={[styles.pin, { left: `${x * 100}%`, top: `${y * 100}%` }]}
            >
              <View style={[styles.pinLabel, { backgroundColor: t.sf, borderColor: color }]}>
                <View style={[styles.pinDot, { backgroundColor: color }]} />
                <T size={11} weight={700} numberOfLines={1}>
                  {popup.name}
                </T>
              </View>
              <View style={[styles.pinStem, { backgroundColor: color }]} />
            </Pressable>
          );
        })}

        {/* 내 위치. 파랑은 지도 색과 절대 겹치지 않아 고정값이다. */}
        {mePoint ? (
          <View style={[styles.me, { left: `${mePoint.x * 100}%`, top: `${mePoint.y * 100}%` }]} />
        ) : null}

        <View style={styles.mapControls}>
          <Pressable
            onPress={me.refresh}
            accessibilityLabel="내 위치 다시 잡기"
            style={[styles.mapBtn, { backgroundColor: t.sf, borderColor: t.ln }]}
          >
            <Icon name="locate" size={17} color={me.fallback ? t.mu : t.l7} />
          </Pressable>
        </View>

        <Pressable onPress={reload} style={[styles.reSearch, { backgroundColor: t.ik }]}>
          <Icon name="refresh" size={13} color={t.bg} strokeWidth={2.4} />
          <T size={12} weight={700} color={t.bg}>
            {loading ? '불러오는 중…' : '목록 새로고침'}
          </T>
        </Pressable>
      </MapCanvas>

      <View style={[styles.sheet, { backgroundColor: t.sf, borderTopColor: t.ln }]}>
        <View style={[styles.handle, { backgroundColor: t.ln }]} />

        <View style={styles.sheetHead}>
          <View style={styles.sheetTitle}>
            <View style={[styles.liveDot, { backgroundColor: t.hi }]} />
            {/* 아직 못 받았을 때 "0곳" 이라고 쓰지 않는다 — 그건 "서울에 열린 팝업이 없다" 는
                뜻이 되고, 연결이 느린 곳에서는 그 거짓말이 몇 초 동안 화면에 서 있는다. */}
            {loading && popups.length === 0 ? (
              <T size={14} weight={800} em={-0.01} color={t.mu}>
                팝업을 불러오는 중
              </T>
            ) : (
              <>
                <T size={14} weight={800} em={-0.01}>
                  지금 열린 팝업{' '}
                </T>
                <T size={14} weight={800} color={t.l7} numeric>
                  {shown.length}
                </T>
                <T size={14} weight={800}>
                  곳
                </T>
              </>
            )}
          </View>

          <Pressable
            onPress={() => navigation.navigate('PopAll')}
            style={[styles.allBtn, { backgroundColor: t.ik }]}
          >
            <Icon name="grid" size={12} color={t.bg} strokeWidth={2.4} />
            <T size={11.5} weight={700} color={t.bg}>
              전체보기
            </T>
          </Pressable>
        </View>

        {/* 목업으로 그리는 중이면 카드 위에 적는다 — 카드 아래에 두면 하단 독에 가린다. */}
        {source === 'mock' ? (
          <T size={10.5} color={t.mu} dim={0.7} leading={1.45} style={styles.mockNote}>
            서버에 연결하지 못해 예시 목록을 보여주고 있어요. 실제로 열려 있는 팝업이 아닙니다.
          </T>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}
        >
          {shown.slice(0, 12).map((popup) => (
            <HomeCard
              key={popup.id}
              popup={popup}
              today={today}
              onPress={() => navigation.navigate('Detail', { id: popup.id })}
            />
          ))}
        </ScrollView>

      </View>

      <BottomDock active="map" />
    </View>
  );
}

/** 하단 시트의 가로 카드. 시안의 146px 폭. */
function HomeCard({
  popup,
  today,
  onPress,
}: {
  popup: PopupStore;
  today: Date;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const cover = popupCoverUrl(popup);
  const badge = popupBadgeVisual(popup.startDate, popup.endDate, today, t);

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: t.sf, borderColor: t.ln }]}>
      <View style={[styles.cardImage, { backgroundColor: t.mp }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <T size={10} weight={700} color={badge.fg}>
              {badge.label}
            </T>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <T size={12.5} weight={700} numberOfLines={1}>
          {popup.name}
        </T>
        <View style={styles.cardMeta}>
          <Icon name="pin" size={10} color={t.mu} strokeWidth={2.4} />
          <T size={10.5} color={t.mu} dim={0.8} numberOfLines={1}>
            {popup.location}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },

  head: { paddingHorizontal: 16, paddingBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  seasonTag: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5 },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 46,
    paddingLeft: 15,
    paddingRight: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchGo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 6, marginTop: 11, paddingRight: 16 },

  /* 이름표 폭을 고정하고 절반만큼 왼쪽으로 당긴다. 예전에는 translateX(-60) 이었는데, 그건
     이름 길이와 무관한 고정값이라 짧은 이름은 오른쪽으로 긴 이름은 왼쪽으로 밀렸다. */
  pin: { position: 'absolute', width: PIN_WIDTH, marginLeft: -PIN_WIDTH / 2, marginTop: -34, alignItems: 'center', gap: 2 },
  pinLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: PIN_WIDTH,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pinDot: { width: 6, height: 6, borderRadius: 3 },
  pinStem: { width: 2, height: 8 },

  me: {
    position: 'absolute',
    marginLeft: -8,
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00a6c4',
    borderWidth: 3,
    borderColor: '#fff',
  },

  mapControls: { position: 'absolute', right: 12, top: 12, gap: 7 },
  mapBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reSearch: {
    position: 'absolute',
    alignSelf: 'center',
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 15,
    borderRadius: 999,
  },

  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 8,
    /* 하단 독이 떠 있는 높이만큼 비운다. 76 이었을 때 카드의 지역 줄이 독에 잘렸다 —
       독은 화면 바닥이 아니라 bottom:30 에 떠 있어서 실제로 먹는 높이가 그보다 크다. */
    paddingBottom: DOCK_INSET,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 9,
  },
  sheetTitle: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  cards: { gap: 10, paddingHorizontal: 16, paddingBottom: 4 },

  card: { width: 146, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardImage: { aspectRatio: 16 / 10 },
  badge: { position: 'absolute', left: 8, top: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  cardBody: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 11, gap: 3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  mockNote: { paddingHorizontal: 16, paddingBottom: 9 },
});
