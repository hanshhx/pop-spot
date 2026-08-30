import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';
import type { PopupStore } from '@/types/popup';

/**
 * 홈 서치존 — 웹 {@code src/features/popup/SearchBox.tsx} 의 {@code SearchZone} 을 옮긴 것.
 *
 * <p><b>한 칸에 두 갈래다.</b> 타이핑하면 즉시 이름·장소 부분일치 후보가 뜨고(서버를 안 부른다),
 * 화살표를 누르거나 키보드에서 검색하면 <b>AI 검색</b>이 돈다. 후보가 떠 있으면 검색 제출은 첫
 * 후보로 바로 간다 — 이미 찾는 것이 눈앞에 있는데 서버를 한 번 더 다녀오는 것은 기다림만 늘린다.
 *
 * <h3>후보가 보는 칸이 전체보기와 다르다</h3>
 *
 * <p>여기는 <b>이름 3개국어 + 장소 3개국어, 여섯 칸</b>만 본다. 전체보기의
 * {@code popAllQuery.haystack} 은 거기에 {@code category} 를 더한 일곱 칸이다. 웹이 그렇게 되어
 * 있어서 같은 검색어인데 서치존에는 안 뜨고 전체보기에는 뜨는 경우가 실제로 있다. 통일하지 않은
 * 것은 "웹과 똑같이" 가 이 작업의 기준이기 때문이다 — 고칠 거면 웹부터 고쳐야 한다.
 *
 * <h3>AI 검색은 서버다</h3>
 *
 * <p>{@code GET /api/search/ai?q=} 가 {@code {results:[{id,name,location}]}} 를 준다. 이름·장소는
 * <b>받은 값을 그대로 쓰지 않고</b> id 로 우리 목록에서 다시 찾아 덮는다 — 서버 응답에 번역 이름이
 * 없어서, 그대로 쓰면 다국어 화면에서 AI 결과만 한국어로 튄다.
 *
 * <p>{@code res.ok} 를 반드시 먼저 본다. {@code fetch} 는 500 에도 거절하지 않으므로, 확인하지
 * 않으면 오류 본문이 "결과 없음" 으로 해석된다 — 고장난 검색을 "찾는 게 없네요" 로 보여 주는 셈이다.
 */

/**
 * 예시 검색어 — <b>보이는 문구와 실제로 보내는 검색어를 나눈다.</b>
 *
 * <p>앱은 한국어뿐이라 지금은 둘이 같다. 그래도 모양을 유지하는 이유는 백엔드 프롬프트가
 * 한국어이기 때문이다 — 나중에 영어 화면이 생겨도 <b>질의는 한국어로 고정</b>해야 한다.
 */
const EXAMPLES = [
  { label: '비 오는 날 감성 카페', query: '비 오는 날 감성 카페' },
  { label: '성수 캐릭터 굿즈', query: '성수 캐릭터 굿즈' },
  { label: '주말 전시 팝업', query: '주말 전시 팝업' },
  { label: '아이랑 가기 좋은 곳', query: '아이랑 가기 좋은 곳' },
] as const;

/** 즉시 후보는 여섯 개까지. 그 아래로 더 보려면 검색을 돌리는 편이 빠르다. */
const SUGGEST_LIMIT = 6;

export interface SearchZoneProps {
  /** 후보·AI 결과를 찾을 모집단. 웹과 같이 "지금 열린 것"({@code open})을 넘긴다. */
  popups: PopupStore[];
  /** 후보나 AI 결과를 골랐을 때. */
  onSelectPopup: (id: number) => void;
  /**
   * AI 검색 결과로 지도를 좁힌다. {@code null} 이면 필터 해제.
   *
   * <p>이걸 넘기면 서치존이 지도 필터 모드가 된다 — 웹의 {@code onAiFilter} 와 같다.
   */
  onAiFilter?: (ids: number[] | null) => void;
}

export function SearchZone({ popups, onSelectPopup, onAiFilter }: SearchZoneProps) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PopupStore[] | null>(null);
  const [erred, setErred] = useState(false);

  /** 이름·장소 부분일치 — 서버를 안 부른다. "마뗑킴" 으로 "마뗑킴 전시" 를 잡는다. */
  const suggestions = useMemo(() => {
    const low = q.trim().toLowerCase();
    if (low.length < 1) return [];
    return popups
      .filter((p) =>
        [p.name, p.location, p.nameEn, p.nameJa, p.locationEn, p.locationJa].some((v) =>
          v?.toLowerCase().includes(low),
        ),
      )
      .slice(0, SUGGEST_LIMIT);
  }, [q, popups]);

  const pick = (p: PopupStore) => {
    setQ('');
    setFocused(false);
    setResults(null);
    setErred(false);
    onAiFilter?.(null);
    onSelectPopup(p.id);
  };

  const run = async (query?: string) => {
    const text = (query ?? q).trim();
    if (!text || loading) return;
    if (query) setQ(query);
    setLoading(true);
    setErred(false);
    try {
      const res = await apiFetch(`/api/search/ai?q=${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error(`ai search ${res.status}`);
      const data: unknown = await res.json().catch(() => ({}));
      const raw = (data as { results?: { id: unknown }[] })?.results;
      /* 서버가 준 id 로 우리 목록에서 다시 찾는다. 목록에 없는 것(좌표 없음·기간 지남 등)은
         버린다 — 눌러도 열 상세가 없다. */
      const list = Array.isArray(raw)
        ? raw
            .map((r) => popups.find((p) => String(p.id) === String(r.id)))
            .filter((p): p is PopupStore => p !== undefined)
        : [];
      setResults(list);
      onAiFilter?.(list.map((p) => p.id));
    } catch {
      setErred(true);
      setResults(null);
      onAiFilter?.(null);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setQ('');
    setResults(null);
    setErred(false);
    onAiFilter?.(null);
  };

  /** 검색 제출 — 후보가 있으면 그리로, 없을 때만 서버를 부른다. */
  const submit = () => {
    if (suggestions.length > 0) {
      pick(suggestions[0]);
      return;
    }
    void run();
  };

  const showSuggest = focused && suggestions.length > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.pill, { backgroundColor: t.sf, borderColor: showSuggest ? t.l5 : t.ln }]}>
        <Icon name="search" size={16} color={t.mu} strokeWidth={2.2} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          /* onBlur 로 즉시 닫으면 후보를 누르는 탭이 닫힘에 먹혀 아무 일도 안 일어난다.
             후보 목록을 누를 때는 pick 이 스스로 닫으므로 여기서는 닫지 않는다. */
          onSubmitEditing={submit}
          returnKeyType="search"
          placeholder="성수 팝업 · 브랜드 · 무드로 검색"
          placeholderTextColor={t.mu}
          style={[styles.input, { color: t.ik }]}
          accessibilityLabel="팝업 검색"
        />
        {q.length > 0 ? (
          <Pressable onPress={reset} accessibilityLabel="검색어 지우기" hitSlop={8}>
            <Icon name="close" size={15} color={t.mu} strokeWidth={2.4} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={submit}
          accessibilityLabel="검색"
          style={[styles.go, { backgroundColor: loading ? t.mp : t.l3 }]}
        >
          <Icon
            name={loading ? 'refresh' : 'arrowRight'}
            size={15}
            color={loading ? t.mu : t.hif}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>

      {showSuggest ? (
        <View style={[styles.dropdown, { backgroundColor: t.sf, borderColor: t.ln }]}>
          {suggestions.map((p) => (
            <Pressable key={p.id} onPress={() => pick(p)} style={styles.suggestRow}>
              <Icon name="pin" size={12} color={t.mu} strokeWidth={2.2} />
              <View style={styles.grow}>
                <T size={12.5} weight={700} numberOfLines={1}>
                  {p.name}
                </T>
                <T size={10.5} color={t.mu} dim={0.8} numberOfLines={1}>
                  {p.location}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* 아직 아무것도 안 쳤을 때만 예시를 보여 준다 — 자연어로 물어도 된다는 것을 말로
          설명하는 것보다 눌러 보게 하는 편이 짧다. */}
      {q.length === 0 && !results && !erred ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.examples}
        >
          {EXAMPLES.map((e) => (
            <Pressable
              key={e.query}
              onPress={() => void run(e.query)}
              style={[styles.example, { borderColor: t.ln, backgroundColor: t.sft }]}
            >
              <T size={11} color={t.mu}>
                {e.label}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {erred ? (
        /* "결과가 없어요" 라고 쓰지 않는다 — 없는 것과 못 물어본 것은 다르고, 사용자는 그 차이로
           다시 시도할지 말지를 정한다. */
        <T size={11.5} color={t.mu} dim={0.85} style={styles.note}>
          검색을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </T>
      ) : results ? (
        results.length === 0 ? (
          <T size={11.5} color={t.mu} dim={0.85} style={styles.note}>
            맞는 팝업을 찾지 못했어요.
          </T>
        ) : (
          <View style={styles.results}>
            <T size={11} weight={700} color={t.l7} numeric style={styles.note}>
              AI 검색 {results.length}곳
            </T>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.examples}
            >
              {results.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => onSelectPopup(p.id)}
                  style={[styles.hit, { borderColor: t.ln, backgroundColor: t.sf }]}
                >
                  <T size={11.5} weight={700} numberOfLines={1}>
                    {p.name}
                  </T>
                  <T size={10} color={t.mu} dim={0.8} numberOfLines={1}>
                    {p.location}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', zIndex: 20 },
  grow: { flex: 1 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 46,
    paddingLeft: 15,
    paddingRight: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 13.5, paddingVertical: 0 },
  go: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  /* 지도 위에 떠야 한다 — 흐름에 두면 지도가 아래로 밀려 화면이 출렁인다. */
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 4,
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },

  examples: { gap: 6, paddingTop: 8 },
  example: { minHeight: 28, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 999, borderWidth: 1 },

  note: { paddingTop: 8 },
  results: { gap: 0 },
  hit: { width: 150, gap: 2, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
});
