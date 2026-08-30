import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import {
  bucketByDay,
  closingCountsByDate,
  groupByRegion,
  toDateKey,
} from '@/features/popup/dayBuckets';
import { regionLabel, type RegionCode } from '@/lib/regions';
import { useTheme } from '@/theme/ThemeProvider';
import type { PopupStore } from '@/types/popup';

/**
 * 팝업 캘린더 — 웹 {@code src/features/popup/PopupCalendar.tsx} 의 앱 판.
 *
 * <p><b>한 칸이 뜻하는 것은 "그날 진행 중" 이 아니라 "그날 바뀌는 것" 이다.</b> 기간이 한 달인
 * 팝업을 그 달의 모든 칸에 넣으면 격자가 통째로 같은 숫자로 덮여 아무 정보가 없다. 그래서
 * 마감·오픈만 목록으로 세고, 그날 열려 있던 것은 <b>숫자 한 줄</b>로만 말한다. 판정은 전부
 * {@code dayBuckets.ts}(웹에서 무수정 이식, 테스트 포함)에 있다.
 *
 * <p>격자 칸에 적는 숫자는 <b>그날 마감하는 곳 수</b>다. 마감이 없는 날은 아무것도 적지 않는다 —
 * 0 을 적으면 "확인했는데 없다" 가 아니라 "여기에도 숫자가 있다" 로 읽혀 눈이 갈 곳을 잃는다.
 *
 * <p>받는 목록은 <b>걸러지지 않은 전체 카탈로그</b>여야 한다({@code usePopups().catalog}).
 * "오늘 열린 것" 만 넘기면 다음 주에 여는 팝업이 통째로 빠져서 오늘이 아닌 날의 '오픈' 은 언제나
 * 0 이 되고, 다음 달로 넘기면 격자가 빈다.
 */

/** 일요일부터. 이 순서를 돌리면 1일의 빈 칸 계산({@code getDay()})과 어긋난다. */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export interface PopupCalendarProps {
  /** 걸러지지 않은 전체 카탈로그. */
  popups: PopupStore[];
  onOpenPopup: (id: number) => void;
}

export function PopupCalendar({ popups, onOpenPopup }: PopupCalendarProps) {
  const { t } = useTheme();
  const today = useMemo(() => new Date(), []);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() =>
    toDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  /** 펼친 지역 칩. 한 번에 하나만 — 아코디언이다. */
  const [openRegion, setOpenRegion] = useState<RegionCode | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  /* 칸마다 bucketByDay 를 부르면 목록을 31번 훑는다. 마감 수는 한 번에 세어 Map 으로 둔다. */
  const closingCounts = useMemo(() => closingCountsByDate(popups), [popups]);
  const buckets = useMemo(() => bucketByDay(popups, selected), [popups, selected]);
  const closingRegions = useMemo(() => groupByRegion(buckets.closing), [buckets.closing]);

  /** 1일의 요일만큼 앞을 비우고 그 달의 일수를 잇는다. */
  const cells = useMemo(() => {
    const lead = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
  }, [year, month]);

  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setCursor(next);
    /* 달을 넘기면 선택일은 1일로 — 전달의 31일을 든 채 넘어가면 없는 날짜를 고른 상태가 된다. */
    setSelected(toDateKey(next.getFullYear(), next.getMonth(), 1));
    setOpenRegion(null);
  };

  const pickDay = (day: number) => {
    setSelected(toDateKey(year, month, day));
    setOpenRegion(null);
  };

  const empty =
    buckets.closing.length === 0 && buckets.opening.length === 0 && buckets.runningCount === 0;

  return (
    <View style={styles.root}>
      <View style={styles.monthBar}>
        <Pressable
          onPress={() => moveMonth(-1)}
          accessibilityLabel="이전 달"
          style={[styles.monthBtn, { borderColor: t.ln, backgroundColor: t.sf }]}
        >
          <Icon name="arrowLeft" size={15} color={t.ik} strokeWidth={2.2} />
        </Pressable>
        <T size={14.5} weight={800} em={-0.01}>
          {year}년 {month + 1}월
        </T>
        <Pressable
          onPress={() => moveMonth(1)}
          accessibilityLabel="다음 달"
          style={[styles.monthBtn, { borderColor: t.ln, backgroundColor: t.sf }]}
        >
          <Icon name="arrowRight" size={15} color={t.ik} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <View key={w} style={styles.cell}>
            <T size={10.5} weight={700} color={i === 0 ? t.ac : t.mu} dim={0.85}>
              {w}
            </T>
          </View>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <View key={`b${i}`} style={styles.cell} />;

          const key = toDateKey(year, month, day);
          const closing = closingCounts.get(key);
          const isToday =
            year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
          const on = key === selected;

          return (
            <Pressable
              key={key}
              onPress={() => pickDay(day)}
              /* 숫자는 눈으로 읽는 것이고, 뜻은 여기서 말한다 — "12" 만 읽어 주면 무엇의 12인지
                 알 수 없다. */
              accessibilityLabel={
                closing ? `${month + 1}월 ${day}일, 마감 ${closing}곳` : `${month + 1}월 ${day}일`
              }
              accessibilityState={{ selected: on }}
              style={[styles.cell, styles.dayCell, on && { backgroundColor: t.l3 }]}
            >
              <T
                size={12.5}
                weight={on || isToday ? 800 : 500}
                color={on ? t.hif : isToday ? t.l7 : t.ik}
                numeric
              >
                {day}
              </T>
              {closing ? (
                <T size={8.5} weight={700} color={on ? t.hif : t.ac} numeric>
                  {closing}
                </T>
              ) : (
                <View style={styles.countSpacer} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.day, { borderTopColor: t.ln }]}>
        <T size={12} weight={800} em={-0.01} style={styles.dayTitle}>
          {selected.slice(5).replace('-', '월 ')}일
        </T>

        {empty ? (
          <T size={11.5} color={t.mu} dim={0.8}>
            이 날은 여닫는 팝업이 없어요.
          </T>
        ) : (
          <>
            {buckets.closing.length > 0 ? (
              <Section title="마감" tone={t.ac} count={buckets.closing.length}>
                {closingRegions ? (
                  /* 마감이 열두 곳을 넘으면 지역 칩으로 접는다. 그 아래로는 묶지 않는다 —
                     칩을 눌러야 볼 수 있는 목록이 세 줄짜리면 접는 것이 손해다. */
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chips}
                    >
                      {closingRegions.map((g) => {
                        const on = openRegion === g.code;
                        return (
                          <Pressable
                            key={g.code}
                            onPress={() => setOpenRegion(on ? null : g.code)}
                            style={[
                              styles.chip,
                              { borderColor: t.ln, backgroundColor: on ? t.ik : t.sf },
                            ]}
                          >
                            <T size={11} weight={700} color={on ? t.bg : t.ik}>
                              {regionLabel(g.code)} {g.popups.length}
                            </T>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    {openRegion
                      ? closingRegions
                          .find((g) => g.code === openRegion)
                          ?.popups.map((p) => (
                            <Row key={p.id} popup={p} onPress={() => onOpenPopup(p.id)} />
                          ))
                      : null}
                  </>
                ) : (
                  buckets.closing.map((p) => (
                    <Row key={p.id} popup={p} onPress={() => onOpenPopup(p.id)} />
                  ))
                )}
              </Section>
            ) : null}

            {buckets.opening.length > 0 ? (
              /* 오픈은 지역으로 묶지 않는다 — 하루에 새로 여는 곳이 열두 곳을 넘는 일이 거의 없다. */
              <Section title="오픈" tone={t.l7} count={buckets.opening.length}>
                {buckets.opening.map((p) => (
                  <Row key={p.id} popup={p} onPress={() => onOpenPopup(p.id)} />
                ))}
              </Section>
            ) : null}

            {buckets.runningCount > 0 ? (
              /* 진행 중은 숫자 한 줄이고 누를 것이 없다. 500개짜리 목록은 정보가 아니라 벽이다. */
              <T size={11.5} color={t.mu} dim={0.85} style={styles.running}>
                이 날 열려 있던 팝업 {buckets.runningCount}곳
              </T>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function Section({
  title,
  tone,
  count,
  children,
}: {
  title: string;
  tone: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <T size={11.5} weight={800}>
          {title}
        </T>
        <T size={11.5} weight={800} color={tone} numeric>
          {count}
        </T>
      </View>
      {children}
    </View>
  );
}

/** 마감·오픈·펼친 지역이 같은 줄 모양을 쓴다 — 웹도 한 컴포넌트다. */
function Row({ popup, onPress }: { popup: PopupStore; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderColor: t.ln, backgroundColor: t.sft }]}>
      <View style={styles.rowBody}>
        <View style={styles.rowTitle}>
          <T size={12} weight={700} numberOfLines={1} style={styles.grow}>
            {popup.name}
          </T>
          {/* 수집한 팝업임을 밝힌다 — 웹 달력 줄과 같은 표시다. */}
          {popup.sourceType === 'CRAWLED' ? (
            <View style={[styles.ai, { borderColor: t.ln }]}>
              <T size={8.5} weight={700} color={t.mu} numeric>
                AI
              </T>
            </View>
          ) : null}
        </View>
        <T size={10.5} color={t.mu} dim={0.8} numberOfLines={1}>
          {popup.location}
        </T>
      </View>
      <Icon name="arrowRight" size={13} color={t.mu} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  grow: { flex: 1 },

  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  /* 일곱 칸이 정확히 한 줄 — 퍼센트로 두면 반올림 오차가 쌓여 마지막 칸이 다음 줄로 떨어진다. */
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCell: { borderRadius: 9, paddingVertical: 5 },
  countSpacer: { height: 11 },

  day: { borderTopWidth: 1, paddingTop: 12, gap: 9 },
  dayTitle: { marginBottom: 1 },
  section: { gap: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  chips: { gap: 6, paddingVertical: 2 },
  chip: { minHeight: 28, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 999, borderWidth: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ai: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1 },

  running: { marginTop: 2 },
});
