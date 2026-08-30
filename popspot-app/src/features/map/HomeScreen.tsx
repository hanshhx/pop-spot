import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { Wordmark } from '@/components/layout/Wordmark';
import { MapCanvas } from '@/components/Map/MapCanvas';
import { popupBadgeVisual } from '@/components/main/popupBadgeStyle';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { SearchZone } from '@/features/popup/SearchZone';
import { useCongestion } from '@/features/popup/useCongestion';
import { usePopups } from '@/features/popup/usePopups';
import { useRecentPopups } from '@/features/popup/useRecentPopups';
import { useMyLocation } from './useMyLocation';
import { railPopups, type RailSort } from '@/lib/homeRail';
import { SEASON_COPY } from '@/lib/season';
import { classifyCategory, kstTodayStart, CATEGORIES, type CategoryCode } from '@/lib/popupSlices';
import { popupCoverUrl } from '@/lib/popupCover';
import { visitedAgo } from '@/lib/visitedAgo';
import { unreadCount, useNotifyStore } from '@/store/useNotifyStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { PopupStore } from '@/types/popup';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 홈 · 지도 — 시안 06.
 *
 * <p>웹 홈의 순서를 그대로 옮겼다: 서치존 → 지도 → 혼잡도·캘린더 지름길 → 최근 본 팝업 →
 * 최근 오픈한 팝업 레일. 웹은 이것들을 지도 아래로 길게 늘어놓지만, 앱은 지도가 화면을 채우는
 * 구조라 <b>하단 시트 안에서 세로로 스크롤</b>한다.
 *
 * <p><b>지도를 스크롤뷰 안에 넣지 않았다.</b> 넣으면 지도를 끌 때 스크롤과 제스처가 싸워서
 * 지도가 안 움직인다 — 사용자가 처음 지적한 문제가 바로 그것이었다. 지도는 형제로 두고 시트만
 * 스크롤한다.
 *
 * <h3>숫자는 하나만 쓴다</h3>
 *
 * <p>화면이 말하는 팝업 수는 {@code count} 하나다 — 웹 {@code mappablePopupCount} 와 같은 값이고,
 * 세 번 걸러낸 것이다(오늘 열려 있고, 지도에서 찾을 수 있고, 같은 행사를 한 번만 센). 웹은 예전에
 * 이 자리만 {@code allPopups.length} 를 써서 한 화면에 "전체" 가 1,002 와 850 두 숫자로 나왔고,
 * 정작 「전체보기」가 여는 목록은 850짜리였다 — 광고한 수와 여는 수가 달랐다.
 *
 * <h3>웹과 하나 다른 것</h3>
 *
 * <p>웹은 레일에 <b>자기 카테고리 칩 줄</b>을 따로 둔다(지도 칩과 별개). 앱은 상단 칩 하나로
 * 지도와 레일을 함께 거른다 — 좁은 화면에 같은 뜻의 칩 줄이 둘이면 어느 쪽이 무엇을 거르는지
 * 알 수 없다. 거르는 규칙 자체({@code classifyCategory})는 같다.
 */

/** 정렬 칩. 기본은 최신순 — 그것이 「최근 오픈한 팝업」의 뜻이다. */
const SORTS: { key: RailSort; label: string }[] = [
  { key: 'latest', label: '최신순' },
  { key: 'deadline', label: '마감임박순' },
  { key: 'popular', label: '인기순' },
];

export default function HomeScreen() {
  const { t, season } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { catalog, open, mappable, popAll, count, source, loading, reload } = usePopups();
  const me = useMyLocation();
  const recent = useRecentPopups();
  const { data: congestion } = useCongestion();
  const [category, setCategory] = useState<CategoryCode | null>(null);
  const [sort, setSort] = useState<RailSort>('latest');
  /** AI 검색이 고른 id. null 이면 필터 없음. 빈 배열은 "0곳" 이라 null 과 다르다. */
  const [aiIds, setAiIds] = useState<number[] | null>(null);
  const unread = unreadCount(useNotifyStore((s) => s.inbox));

  const today = useMemo(() => kstTodayStart(), []);

  /** 칩에 붙는 곳수. 지도와 같은 모집단에서 센다 — 세는 것과 찍는 것이 갈리면 안 된다. */
  const counts = useMemo(() => {
    const map = new Map<CategoryCode, number>();
    for (const p of mappable) {
      const code = classifyCategory(p.category);
      map.set(code, (map.get(code) ?? 0) + 1);
    }
    return map;
  }, [mappable]);

  /** 지도에 찍을 것 — 카테고리 칩과 AI 검색 결과를 차례로 건다. */
  const pins = useMemo(() => {
    let list = mappable;
    if (category) list = list.filter((p) => classifyCategory(p.category) === category);
    if (aiIds) {
      const set = new Set(aiIds);
      list = list.filter((p) => set.has(p.id));
    }
    return list;
  }, [mappable, category, aiIds]);

  /** 레일 — 같은 행사를 한 번만 센 목록에서 뽑는다. 안 그러면 스크롤해도 같은 행사만 나온다. */
  const rail = useMemo(
    () => railPopups(popAll, sort, category ?? 'all'),
    [popAll, sort, category],
  );

  /** 최근 본 팝업 — 기록이 없으면 그 줄을 아예 그리지 않는다. */
  const seen = recent.visits.slice(0, 10);

  /* 계절 배지 — 계절을 고르지 않았으면 브랜드다. 시안 홈 왼쪽 위의 작은 라벨. */
  const seasonTag = season === 'brand' ? 'BRAND' : SEASON_COPY[season].upper;
  const openDetail = (id: number) => navigation.navigate('Detail', { id });

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

        {/* 서치존 — 웹과 같이 지금 열린 것 전부에서 찾는다(카테고리 칩은 지도만 거른다). */}
        <SearchZone popups={open} onSelectPopup={openDetail} onAiFilter={setAiIds} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label="전체"
            count={loading && catalog.length === 0 ? undefined : count}
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

      <MapCanvas
        popups={pins}
        me={me.fallback ? null : { lat: me.lat, lng: me.lng }}
        center={{ lat: me.lat, lng: me.lng }}
        onPressPopup={openDetail}
      >
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

      <View
        style={[
          styles.sheet,
          { backgroundColor: t.sf, borderTopColor: t.ln, maxHeight: height * 0.46 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: t.ln }]} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.sheetScroll, { paddingBottom: DOCK_INSET }]}
        >
          <View style={styles.sheetHead}>
            <View style={styles.sheetTitle}>
              <View style={[styles.liveDot, { backgroundColor: t.hi }]} />
              {/* 아직 못 받았을 때 "0곳" 이라고 쓰지 않는다 — 그건 "서울에 열린 팝업이 없다" 는
                  뜻이 되고, 연결이 느린 곳에서는 그 거짓말이 몇 초 동안 화면에 서 있는다. */}
              {loading && catalog.length === 0 ? (
                <T size={14} weight={800} em={-0.01} color={t.mu}>
                  팝업을 불러오는 중
                </T>
              ) : (
                <>
                  <T size={14} weight={800} em={-0.01}>
                    지금 열린 팝업{' '}
                  </T>
                  <T size={14} weight={800} color={t.l7} numeric>
                    {count}
                  </T>
                  <T size={14} weight={800}>
                    곳
                  </T>
                </>
              )}
            </View>

            <Pressable
              onPress={() => navigation.navigate('PopAll', {})}
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

          {/* 지도 아래 지름길 — 혼잡도(공간)와 캘린더(시간). 웹도 이 둘을 한 줄에 나란히 둔다. */}
          <View style={styles.tiles}>
            <Pressable
              onPress={() => navigation.navigate('Guide')}
              style={[styles.tile, { borderColor: t.ln, backgroundColor: t.sft }]}
            >
              <View style={styles.tileHead}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: congestion ? congestionTone(congestion.level, t) : t.hi },
                  ]}
                />
                <T size={11.5} weight={800} numberOfLines={1}>
                  실시간 혼잡도
                </T>
              </View>
              {/* 지역 이름을 반드시 함께 적는다 — 이 값은 팝업이 아니라 지역 단위다. */}
              <T size={10.5} color={t.mu} dim={0.85} numberOfLines={1}>
                {congestion ? `${congestion.areaName ?? '성수'} · ${congestion.level}` : '불러오는 중'}
              </T>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('Schedule')}
              style={[styles.tile, { borderColor: t.ln, backgroundColor: t.sft }]}
            >
              <View style={styles.tileHead}>
                <Icon name="calendar" size={13} color={t.l7} strokeWidth={2.2} />
                <T size={11.5} weight={800} numberOfLines={1}>
                  팝업 캘린더
                </T>
              </View>
              <T size={10.5} color={t.mu} dim={0.85} numberOfLines={1}>
                언제 열고 닫는지 한눈에
              </T>
            </Pressable>
          </View>

          {seen.length > 0 ? (
            <View style={styles.block}>
              <T size={11.5} weight={800} color={t.mu} style={styles.blockTitle}>
                최근 본 팝업
              </T>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cards}
              >
                {seen.map((v) => {
                  const ago = visitedAgo(v.visitedAt);
                  return (
                    <Pressable
                      key={v.popupId}
                      onPress={() => openDetail(v.popupId)}
                      style={[styles.seenCard, { borderColor: t.ln, backgroundColor: t.sft }]}
                    >
                      <T size={11.5} weight={700} numberOfLines={1}>
                        {v.popupName || '이름 없음'}
                      </T>
                      <T size={10} color={t.mu} dim={0.8} numeric>
                        {agoText(ago)}
                      </T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.block}>
            <View style={styles.blockHead}>
              <T size={11.5} weight={800} color={t.mu}>
                최근 오픈한 팝업
              </T>
              <View style={styles.sorts}>
                {SORTS.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => setSort(s.key)}
                    style={[
                      styles.sortChip,
                      { backgroundColor: sort === s.key ? t.l3 : 'transparent' },
                    ]}
                  >
                    <T size={10.5} weight={700} color={sort === s.key ? t.hif : t.mu}>
                      {s.label}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cards}
            >
              {rail.map((popup) => (
                <HomeCard
                  key={popup.id}
                  popup={popup}
                  today={today}
                  seen={recent.has(popup.id)}
                  onPress={() => openDetail(popup.id)}
                />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      <BottomDock active="map" />
    </View>
  );
}

/** 혼잡도 단계 → 점 색. 서버가 주는 한국어 단계를 그대로 받는다. */
function congestionTone(level: string, t: { hi: string; ac: string; l7: string }): string {
  if (level.includes('붐빔')) return t.ac;
  if (level.includes('약간')) return t.l7;
  return t.hi;
}

/** {@code visitedAgo} 가 준 모양을 한국어 한 줄로. 말을 만드는 것은 그리는 쪽 일이다. */
function agoText(ago: ReturnType<typeof visitedAgo>): string {
  if (!ago) return '';
  if (ago.kind === 'today') return '오늘 봄';
  if (ago.kind === 'yesterday') return '어제 봄';
  if (ago.kind === 'days') return `${ago.days}일 전`;
  return `${ago.month}월 ${ago.day}일`;
}

/** 하단 시트의 가로 카드. 시안의 146px 폭. */
function HomeCard({
  popup,
  today,
  seen,
  onPress,
}: {
  popup: PopupStore;
  today: Date;
  seen: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const cover = popupCoverUrl(popup);
  const badge = popupBadgeVisual(popup.startDate, popup.endDate, today, t);

  return (
    <Pressable
      onPress={onPress}
      /* 이미 본 곳은 흐리게 — 웹 POP-ALL 의 「본 팝업」 표시와 같은 뜻이다. 지우지는 않는다. */
      style={[styles.card, { backgroundColor: t.sf, borderColor: t.ln, opacity: seen ? 0.62 : 1 }]}
    >
      <View style={[styles.cardImage, { backgroundColor: t.mp }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
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

  head: { paddingHorizontal: 16, paddingBottom: 10, zIndex: 20 },
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

  chips: { gap: 6, marginTop: 11, paddingRight: 16 },

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
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetScroll: { gap: 14 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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

  tiles: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  tile: { flex: 1, gap: 3, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },

  block: { gap: 8 },
  blockTitle: { paddingHorizontal: 16 },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sorts: { flexDirection: 'row', gap: 2 },
  sortChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },

  cards: { gap: 10, paddingHorizontal: 16, paddingBottom: 4 },

  card: { width: 146, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardImage: { aspectRatio: 16 / 10 },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  cardBody: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 11, gap: 3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  seenCard: {
    width: 132,
    gap: 3,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  mockNote: { paddingHorizontal: 16 },
});
