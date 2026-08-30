import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PopupCard } from '@/components/main/PopupCard';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { font } from '@/theme/typography';
import {
  EMPTY_POP_ALL_QUERY,
  runPopAllQuery,
  type PopAllQuery,
  type PopAllSort,
  type RelaxSuggestion,
} from '@/lib/popAllQuery';
import { CATEGORIES, kstTodayStart, type CategoryCode } from '@/lib/popupSlices';
import { popupCoverUrl } from '@/lib/popupCover';
import { REGIONS, type RegionCode } from '@/lib/regions';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';
import { pageWindow, relaxPatch } from './pageWindow';
import { usePopups } from './usePopups';
import { useRecentPopups } from './useRecentPopups';

/**
 * 전체보기(POP-ALL) — 시안 07. 웹 {@code PopAllModal} 의 앱 판.
 *
 * <p><b>거르고 정렬하는 일은 한 줄도 새로 쓰지 않았다.</b> {@code runPopAllQuery} 를 그대로 부른다 —
 * 정렬 세 축의 동점 처리, 결과 0일 때의 "조건 하나만 풀면 N곳", 범위를 벗어난 페이지를 당겨 넣는
 * 것까지 웹에서 테스트와 함께 온 것이다. 여기서 다시 쓰면 두 벌이 되고, 두 벌은 갈린다.
 *
 * <p>시안이 웹에서 바꾼 것 둘을 그대로 따랐다 — 분야는 select 대신 칩 줄, 최근 본 팝업은 우측
 * 패널 대신 하단 가로 레일. <b>지역도 칩 줄로 바꿨다</b>: 시안은 select 를 남겼지만 RN 에는
 * 네이티브 select 가 없어 플랫폼마다 다른 모달이 뜨고, 분야를 칩으로 바꾼 것과 같은 이유가 지역에도
 * 그대로 적용된다.
 */

const SORTS: { key: PopAllSort; label: string }[] = [
  { key: 'latest', label: '최신순' },
  { key: 'deadline', label: '마감임박순' },
  { key: 'popular', label: '인기순' },
];

const BADGES: { key: 'closingSoon' | 'openingToday'; label: string }[] = [
  { key: 'closingSoon', label: '마감 임박' },
  { key: 'openingToday', label: '오늘 오픈' },
];

/** 완화 제안의 사전 — 어느 조건을 푸는지 사람 말로. */
const RELAX_LABEL: Record<RelaxSuggestion['field'], string> = {
  keyword: '검색어 지우기',
  region: '지역 전체로',
  category: '분야 전체로',
  badge: '조건 해제',
};

export default function PopAllScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { popAll: popups } = usePopups();
  const recent = useRecentPopups();

  /* 검색 화면에서 넘어온 조건으로 시작한다. 조건 없이 열면 「나머지 N곳 보기」를 눌렀을 때
     검색어가 사라진 전체 목록이 나온다 — 누른 것과 열린 것이 다르다. */
  const params = useRoute<RouteProp<RootStackParamList, 'PopAll'>>().params;
  const [query, setQuery] = useState<PopAllQuery>(() => ({
    ...EMPTY_POP_ALL_QUERY,
    keyword: params?.keyword ?? EMPTY_POP_ALL_QUERY.keyword,
    category: (params?.category as PopAllQuery['category']) ?? EMPTY_POP_ALL_QUERY.category,
  }));
  const today = useMemo(() => kstTodayStart(), []);
  const result = useMemo(() => runPopAllQuery(popups, query, today), [popups, query, today]);

  /* 조건을 바꾸면 언제나 1페이지로. 3페이지를 보다가 필터를 걸면 볼 것이 없는 자리에 남는다. */
  const patch = (next: Partial<PopAllQuery>) => setQuery((q) => ({ ...q, ...next, page: 1 }));

  const recentPopups = recent.ids
    .map((id) => popups.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .slice(0, 8);

  const open = (id: number) => {
    navigation.navigate('Detail', { id });
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.head, { backgroundColor: t.sf, borderBottomColor: t.ln, paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <T size={19} weight={800} em={-0.02} numeric>
            POP-ALL
          </T>
          <T size={11.5} weight={700} color={t.mu} dim={0.8} style={styles.grow}>
            오늘 서울에서 갈 수 있는 곳 전부
          </T>
          <Pressable
            onPress={navigation.goBack}
            accessibilityLabel="닫기"
            style={[styles.closeBtn, { backgroundColor: t.mp }]}
          >
            <Icon name="close" size={14} color={t.ik} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={[styles.searchBox, { backgroundColor: t.bg, borderColor: t.ln }]}>
          <Icon name="search" size={15} color={t.mu} strokeWidth={2.2} />
          <TextInput
            value={query.keyword}
            onChangeText={(keyword) => patch({ keyword })}
            placeholder="이름이나 장소로 검색"
            placeholderTextColor={t.mu}
            style={[styles.input, font(400), { color: t.ik }]}
          />
          {query.keyword.length > 0 ? (
            <Pressable
              onPress={() => patch({ keyword: '' })}
              accessibilityLabel="검색어 지우기"
              style={[styles.clearBtn, { backgroundColor: t.mp }]}
            >
              <Icon name="close" size={11} color={t.ik} strokeWidth={2.6} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Chip label="전체" height={30} fontSize={11.5} on={query.category === null} onPress={() => patch({ category: null })} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.code}
              label={c.label}
              height={30}
              fontSize={11.5}
              on={query.category === c.code}
              onPress={() => patch({ category: c.code as CategoryCode })}
            />
          ))}
          {/* 분야도 마찬가지 — CATEGORIES 에 없는 'other' 를 손으로 넣는다. */}
          <Chip
            label="기타"
            height={30}
            fontSize={11.5}
            on={query.category === 'other'}
            onPress={() => patch({ category: 'other' })}
          />
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Chip label="전체 지역" height={30} fontSize={11.5} on={query.region === null} onPress={() => patch({ region: null })} />
          {REGIONS.map((r) => (
            <Chip
              key={r.code}
              label={r.label}
              height={30}
              fontSize={11.5}
              on={query.region === r.code}
              onPress={() => patch({ region: r.code as RegionCode })}
            />
          ))}
          {/* REGIONS 에 없는 유일한 유효 코드. 이게 빠지면 지역이 'other' 인 팝업(실측 43%)이
              지역 필터로는 닿지 않는 곳이 된다. 웹 PopAllFilterBar 도 손으로 하나 더 넣는다. */}
          <Chip
            label="기타"
            height={30}
            fontSize={11.5}
            on={query.region === 'other'}
            onPress={() => patch({ region: 'other' })}
          />
        </ScrollView>

        <View style={styles.filterRow}>
          {BADGES.map((b) => (
            <Chip
              key={b.key}
              label={b.label}
              height={30}
              fontSize={11.5}
              on={query.badge === b.key}
              activeBg={t.l3}
              activeFg={t.hif}
              onPress={() => patch({ badge: query.badge === b.key ? null : b.key })}
            />
          ))}
          <View style={styles.grow} />
          <T size={11.5} weight={800} color={t.mu} numeric>
            결과 {result.total.toLocaleString()}곳
          </T>
        </View>

        <View style={[styles.sortWrap, { borderColor: t.ln }]}>
          {SORTS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => patch({ sort: s.key })}
              style={[styles.sortBtn, query.sort === s.key && { backgroundColor: t.ik }]}
            >
              <T size={11} weight={700} color={query.sort === s.key ? t.bg : t.mu}>
                {s.label}
              </T>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {result.total > 0 ? (
          <View style={styles.grid}>
            {result.items.map((popup) => (
              <View key={popup.id} style={styles.cell}>
                <PopupCard popup={popup} today={today} seen={recent.has(popup.id)} onPress={() => open(popup.id)} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Icon name="searchOff" size={30} color={t.mu} strokeWidth={1.8} opacity={0.55} />
            <T size={13.5} weight={800}>
              이 조건에는 없어요
            </T>
            <View style={styles.relaxRow}>
              {/* 풀어도 0인 조건은 제안하지 않는다 — 눌렀는데 또 0이면 두 번째 막다른 길이다. */}
              {result.relaxSuggestions.map((s) => (
                <Pressable
                  key={s.field}
                  onPress={() => setQuery((q) => ({ ...q, ...relaxPatch(s.field) }))}
                  style={[styles.relaxBtn, { borderColor: t.ln }]}
                >
                  <T size={11.5} weight={700}>
                    {RELAX_LABEL[s.field]} ({s.count}곳)
                  </T>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setQuery(EMPTY_POP_ALL_QUERY)}
                style={[styles.relaxBtn, { backgroundColor: t.l3, borderColor: t.l3 }]}
              >
                <T size={11.5} weight={800} color={t.hif}>
                  조건 모두 지우기
                </T>
              </Pressable>
            </View>
          </View>
        )}

        {result.totalPages > 1 ? (
          <View style={styles.pager}>
            {pageWindow(result.page, result.totalPages).map((n, i) =>
              n === 'gap' ? (
                <T key={`gap-${i}`} size={12} color={t.mu} numeric>
                  …
                </T>
              ) : (
                <Pressable
                  key={n}
                  onPress={() => setQuery((q) => ({ ...q, page: n }))}
                  style={[styles.pageBtn, n === result.page && { backgroundColor: t.ik }]}
                >
                  <T size={12} weight={700} color={n === result.page ? t.bg : t.mu} numeric>
                    {n}
                  </T>
                </Pressable>
              ),
            )}
          </View>
        ) : null}

        {recentPopups.length > 0 ? (
          <View style={[styles.recent, { backgroundColor: t.sf, borderTopColor: t.ln }]}>
            <T size={11.5} weight={800} color={t.mu} style={styles.recentTitle}>
              최근 본 팝업
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
              {recentPopups.map((p) => {
                const cover = popupCoverUrl(p);
                return (
                  <Pressable key={p.id} onPress={() => open(p.id)} style={styles.recentItem}>
                    <View style={[styles.recentThumb, { backgroundColor: t.mp }]}>
                      {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                    </View>
                    <T size={11} weight={700} numberOfLines={1}>
                      {p.name}
                    </T>
                    <T size={9.5} color={t.mu} dim={0.75} numberOfLines={1}>
                      {p.location}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },

  head: { paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, gap: 9 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 13.5, padding: 0 },
  clearBtn: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  row: { gap: 5, paddingRight: 14 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortWrap: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  sortBtn: { minHeight: 26, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },

  list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },

  empty: { alignItems: 'center', gap: 12, paddingVertical: 52, paddingHorizontal: 16 },
  relaxRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  relaxBtn: { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },

  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 14 },
  pageBtn: { minWidth: 30, minHeight: 30, paddingHorizontal: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  recent: { marginTop: 16, marginHorizontal: -14, padding: 14, borderTopWidth: 1 },
  recentTitle: { marginBottom: 10 },
  recentRow: { gap: 9 },
  recentItem: { width: 96, gap: 2 },
  recentThumb: { aspectRatio: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
});
