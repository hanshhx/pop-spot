import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryLabelColor } from '@/components/main/categoryVisual';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { EMPTY_POP_ALL_QUERY, runPopAllQuery } from '@/lib/popAllQuery';
import { periodText } from '@/lib/periodText';
import { popupCoverUrl } from '@/lib/popupCover';
import { categoryLabel, classifyCategory, kstTodayStart } from '@/lib/popupSlices';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import type { RootStackParamList } from '@/types/navigation';
import { usePopups } from './usePopups';
import { useRecentPopups } from './useRecentPopups';
import { useRecentSearches } from './useRecentSearches';

/**
 * 검색 — 시안 08. 웹 {@code GlobalSearchModal} 의 앱 판.
 *
 * <p>거르는 일은 {@code runPopAllQuery} 가 한다. 이름·장소를 훑는 규칙(3개 국어 이름과 장소,
 * 대소문자 무시)이 전체보기와 같아야 "검색에선 나오는데 전체보기에선 안 나오는" 일이 없다.
 *
 * <p>디바운스가 없다. 목록이 통째로 메모리에 있어 타이핑마다 즉시 결과가 나오고, 서버를 부르지
 * 않으므로 늦출 이유가 없다 — 웹 {@code popAllQuery} 주석이 말하는 그 구조다.
 */
export default function SearchScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { popups } = usePopups();
  const recentSearches = useRecentSearches();
  const recentPopups = useRecentPopups();

  const [keyword, setKeyword] = useState('');
  const today = useMemo(() => kstTodayStart(), []);

  const result = useMemo(
    () => runPopAllQuery(popups, { ...EMPTY_POP_ALL_QUERY, keyword }, today),
    [popups, keyword, today],
  );

  const typed = keyword.trim().length > 0;

  const open = (id: number) => {
    if (typed) recentSearches.push(keyword);
    recentPopups.push(id);
    navigation.navigate('Detail', { id });
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.backBtn}>
          <Icon name="arrowLeft" size={20} color={t.ik} strokeWidth={2.2} />
        </Pressable>
        <View style={[styles.field, { backgroundColor: t.sf, borderColor: t.l4 }]}>
          <Icon name="search" size={15} color={t.l7} strokeWidth={2.2} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => recentSearches.push(keyword)}
            placeholder="성수 팝업 · 브랜드 · 무드로 검색"
            placeholderTextColor={t.mu}
            autoFocus
            returnKeyType="search"
            style={[styles.input, font(600), { color: t.ik }]}
          />
          {typed ? (
            <Pressable onPress={() => setKeyword('')} accessibilityLabel="지우기" hitSlop={8}>
              <Icon name="close" size={14} color={t.mu} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {recentSearches.queries.length > 0 ? (
          <>
            <T size={11} weight={700} color={t.mu} dim={0.7} style={styles.sectionTitle}>
              최근 검색어
            </T>
            <View style={styles.chipWrap}>
              {recentSearches.queries.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => setKeyword(q)}
                  style={[styles.recentChip, { backgroundColor: t.sf, borderColor: t.ln }]}
                >
                  <T size={12} weight={600}>
                    {q}
                  </T>
                  <Pressable onPress={() => recentSearches.remove(q)} hitSlop={8}>
                    <Icon name="close" size={11} color={t.mu} opacity={0.5} strokeWidth={2.4} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {typed ? (
          <>
            <View style={styles.sectionTitle}>
              <T size={11} weight={700} color={t.mu} dim={0.7}>
                검색 결과{' '}
              </T>
              <T size={11} weight={700} color={t.l7} numeric>
                {result.total}
              </T>
            </View>

            {result.total === 0 ? (
              <View style={styles.empty}>
                <Icon name="searchOff" size={28} color={t.mu} strokeWidth={1.8} opacity={0.5} />
                <T size={13} weight={700}>
                  찾는 팝업이 없어요
                </T>
                <T size={11.5} color={t.mu} dim={0.8}>
                  다른 이름이나 동네로 검색해 보세요.
                </T>
              </View>
            ) : (
              <View style={styles.list}>
                {result.items.map((p) => {
                  const cover = popupCoverUrl(p, 160);
                  const code = classifyCategory(p.category);
                  const { color, tint } = categoryLabelColor(code);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => open(p.id)}
                      style={[styles.row, { backgroundColor: t.sf, borderColor: t.ln }]}
                    >
                      <View style={[styles.thumb, { backgroundColor: t.mp }]}>
                        {cover ? (
                          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : null}
                      </View>
                      <View style={styles.rowBody}>
                        <T size={13} weight={700} numberOfLines={1}>
                          {p.name}
                        </T>
                        <T size={11} color={t.mu} dim={0.8} numberOfLines={1}>
                          {p.location} · {periodText(p.startDate, p.endDate)}
                        </T>
                        <View style={[styles.catChip, { backgroundColor: tint }]}>
                          <T size={9.5} weight={700} color={color ?? t.ik}>
                            {categoryLabel(code)}
                          </T>
                        </View>
                      </View>
                      <Icon name="chevronRight" size={16} color={t.mu} opacity={0.5} />
                    </Pressable>
                  );
                })}

                {result.total > result.items.length ? (
                  <Pressable
                    onPress={() => navigation.navigate('PopAll')}
                    style={[styles.moreBtn, { borderColor: t.ln }]}
                  >
                    <T size={12} weight={700} color={t.mu}>
                      전체보기에서 나머지 {result.total - result.items.length}곳 보기
                    </T>
                  </Pressable>
                ) : null}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 13.5, padding: 0 },

  body: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: { flexDirection: 'row', marginTop: 6, marginBottom: 9 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
  },

  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 9, borderRadius: 14, borderWidth: 1 },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden' },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  catChip: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },

  moreBtn: { minHeight: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
});
