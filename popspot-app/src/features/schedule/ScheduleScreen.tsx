import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { usePopups } from '@/features/popup/usePopups';
import { addToCalendar, toCalendarEvent } from '@/lib/calendar';
import { ddayBadge } from '@/lib/dday';
import { usePlanStore } from '@/store/usePlanStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { PopupStore } from '@/types/popup';
import type { RootStackParamList } from '@/types/navigation';
import { PopupCalendar } from './PopupCalendar';
import { useMySchedule } from './useMySchedule';

/**
 * 일정 — 웹 홈의 SCHEDULE 탭을 그대로 옮긴 것.
 *
 * <p>웹은 이 탭을 두 블록으로 둔다: 위가 <b>내가 본 팝업</b>({@code MySchedule}), 아래가
 * <b>전체 팝업 달력</b>({@code PopupCalendar}). 달력이 "무엇이 열려 있나" 에 답한다면 위 블록은
 * <b>"내가 관심 뒀던 것이 언제 사라지나"</b> 에 답한다 — 같은 것을 두 번 놓지 않으려고 갈라 둔 것이다.
 *
 * <p><b>두 블록이 서로 다른 목록을 받는다.</b> 내가 본 팝업은 {@code open}(오늘 열려 있는 것),
 * 달력은 {@code catalog}(걸러지지 않은 전체)다. 달력에까지 "오늘 열린 것" 만 넘기면 다음 주에
 * 여는 팝업이 통째로 빠져 다른 날의 '오픈' 이 언제나 0 이 되고, 다음 달로 넘기면 격자가 빈다.
 *
 * <p><b>로그인을 요구하지 않는다.</b> 웹도 이 탭만은 잠그지 않는다 — 기록은 기기 안에 쌓이고,
 * 달력은 넘겨받은 팝업을 놓을 뿐이라 처음 온 사람에게도 내용이 찬다.
 *
 * <h3>이 화면에 원래 있던 것 — 최단 동선</h3>
 *
 * <p>독의 「일정」칸은 그동안 {@code PlannerScreen}(도보·지하철·차량 최단 동선)으로 갔다. 그건
 * 웹에 없는 앱 고유 기능이라 없애지 않고 <b>여기서 들어가게</b> 두었다. 담은 곳이 있으면 그 수를
 * 함께 적는다 — 비어 있는데 "동선 짜기" 만 있으면 눌러서 빈 화면을 만나게 된다.
 */
export default function ScheduleScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { open, catalog, loading } = usePopups();
  const mine = useMySchedule(open);
  const stops = usePlanStore((s) => s.stops);

  const openDetail = (id: number) => navigation.navigate('Detail', { id });

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <T size={22} weight={800} em={-0.02}>
          일정
        </T>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: DOCK_INSET + 16 }]}>
        {/* 최단 동선 — 앱에만 있는 것. 담은 곳이 없으면 그 사실을 먼저 말한다. */}
        <Pressable
          onPress={() => navigation.navigate('Planner')}
          style={[styles.planner, { borderColor: t.ln, backgroundColor: t.sf }]}
        >
          <View style={[styles.plannerIcon, { backgroundColor: t.l3 }]}>
            <Icon name="course" size={16} color={t.hif} strokeWidth={2.2} />
          </View>
          <View style={styles.grow}>
            <T size={13} weight={800} em={-0.01}>
              최단 동선 짜기
            </T>
            <T size={11} color={t.mu} dim={0.85}>
              {stops.length > 0
                ? `담은 ${stops.length}곳을 도보·지하철·차량으로`
                : '상세에서 「동선에 담기」를 누르면 여기 모여요'}
            </T>
          </View>
          <Icon name="arrowRight" size={15} color={t.mu} />
        </Pressable>

        {/* 내가 본 팝업 — 기록이 없으면 아무것도 그리지 않는다. 유입의 대부분이 처음 온 사람이라,
            그들에게 빈 칸을 보여 주면 빈 화면을 하나 더 만드는 셈이다. */}
        {mine.length > 0 ? (
          <View style={styles.block}>
            <T size={14} weight={800} em={-0.01} style={styles.blockTitle}>
              내가 본 팝업
            </T>
            <View style={styles.rows}>
              {mine.map((popup) => (
                <MineRow key={popup.id} popup={popup} onPress={() => openDetail(popup.id)} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <T size={14} weight={800} em={-0.01} style={styles.blockTitle}>
            전체 팝업 달력
          </T>
          <View style={[styles.calendarCard, { borderColor: t.ln, backgroundColor: t.sf }]}>
            {loading && catalog.length === 0 ? (
              <T size={12} color={t.mu} dim={0.8}>
                불러오는 중이에요.
              </T>
            ) : (
              <PopupCalendar popups={catalog} onOpenPopup={openDetail} />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomDock active="plan" />
    </View>
  );
}

/** 한 줄 — [D-day 배지] [이름] [일정 저장]. 웹 MySchedule 의 한 줄과 같은 구성이다. */
function MineRow({ popup, onPress }: { popup: PopupStore; onPress: () => void }) {
  const { t } = useTheme();
  const dday = ddayBadge(popup.endDate);
  /* 날짜가 정확히 YYYY-MM-DD 가 아니면 null 이다. 지어낸 일정을 남의 달력에 넣는 것은 정보가
     없는 것보다 나쁘므로, null 이면 버튼 자체를 그리지 않는다. */
  const canSave = toCalendarEvent(popup) !== null;

  return (
    <View style={[styles.row, { borderColor: t.ln, backgroundColor: t.sft }]}>
      {dday ? (
        <View style={[styles.dday, { backgroundColor: t.l3 }]}>
          <T size={10.5} weight={700} color={t.hif} numeric>
            {dday.labelKey === 'card.today' ? '오늘 마감' : `D-${dday.days}`}
          </T>
        </View>
      ) : null}

      <Pressable onPress={onPress} style={styles.grow}>
        <T size={12.5} weight={700} numberOfLines={1}>
          {popup.name}
        </T>
      </Pressable>

      {canSave ? (
        <Pressable
          /* 보이는 글자는 줄마다 똑같다 — 스크린리더가 버튼만 나열하면 셋 다 같은 이름으로
             들려 어느 팝업 것인지 알 수 없다. 접근성 이름에만 팝업명을 더한다. */
          accessibilityLabel={`일정 저장 — ${popup.name}`}
          onPress={() => {
            /* 돌려받은 값으로 "저장됨" 을 알리지 않는다 — 여기서 아는 것은 캘린더를 열었다는
               것까지이고, 사용자가 거기서 저장을 눌렀는지는 알 수 없다. */
            void addToCalendar(popup);
          }}
          style={[styles.save, { borderColor: t.ln, backgroundColor: t.sf }]}
        >
          <Icon name="calendar" size={12} color={t.ik} strokeWidth={2.2} />
          <T size={10.5} weight={700}>
            저장
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },

  head: { paddingHorizontal: 16, paddingBottom: 12 },
  scroll: { paddingHorizontal: 16, gap: 18 },

  planner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  plannerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  block: { gap: 9 },
  blockTitle: {},
  rows: { gap: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  dday: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  calendarCard: { borderWidth: 1, borderRadius: 18, padding: 14 },
});
