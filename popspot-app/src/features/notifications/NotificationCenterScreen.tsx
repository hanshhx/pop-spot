import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { MAX_PER_DAY, QUIET_END_HOUR, QUIET_START_HOUR, type NotifyKind } from '@/lib/notifyRules';
import { unreadCount, useNotifyStore, type InboxItem } from '@/store/useNotifyStore';
import { tintOnSurface } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 알림 센터 — 시안 14. 웹 {@code NotificationCenter} 를 앱 화면으로.
 *
 * <p>목록 아래에 <b>발송 설정을 같이 둔다</b>. "알림이 시끄럽다" 의 해결 경로를 한 화면에 놓기
 * 위해서다 — 설정을 다른 데 숨겨 두면 사람은 설정을 찾는 대신 앱 알림을 통째로 끈다.
 */

/** 종류마다의 아이콘과 언제 오는지. 시안의 설정 목록 그대로. */
const KINDS: { kind: NotifyKind; label: string; when: string; icon: IconName }[] = [
  {
    kind: 'wishClosing',
    label: '찜한 팝업 마감 3일 전',
    when: 'D-3 오전 9시 · 팝업당 1회',
    icon: 'bell',
  },
  {
    kind: 'courseNext',
    label: '코스 진행 중 다음 장소',
    when: '체류 30분 경과 또는 다음 장소 500m 안',
    icon: 'compass',
  },
  { kind: 'weekly', label: '주간 요약', when: '매주 월요일 오전 9시', icon: 'calendar' },
  {
    kind: 'newPopup',
    label: '새 팝업 등록',
    when: '관심 분야에 새 팝업이 열릴 때 — 기본 꺼짐',
    icon: 'message',
  },
];

const ICON_OF: Record<NotifyKind, IconName> = {
  wishClosing: 'bell',
  courseNext: 'compass',
  weekly: 'calendar',
  newPopup: 'message',
};

export default function NotificationCenterScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const inbox = useNotifyStore((s) => s.inbox);
  const settings = useNotifyStore((s) => s.settings);
  const setSetting = useNotifyStore((s) => s.setSetting);
  const markRead = useNotifyStore((s) => s.markRead);
  const markAllRead = useNotifyStore((s) => s.markAllRead);

  const unread = unreadCount(inbox);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.head, { backgroundColor: t.sf, borderBottomColor: t.ln, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.back}>
          <Icon name="arrowLeft" size={19} color={t.ik} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.titleRow}>
          <T size={16.5} weight={800}>
            알림
          </T>
          {unread > 0 ? (
            <View style={[styles.unread, { backgroundColor: t.ac }]}>
              <T size={10} weight={700} color="#fff" numeric>
                {unread}
              </T>
            </View>
          ) : null}
        </View>
        <View style={styles.grow} />
        {unread > 0 ? (
          <Pressable onPress={markAllRead} style={styles.readAll}>
            <Icon name="checkAll" size={14} color={t.l7} strokeWidth={2.4} />
            <T size={12} weight={700} color={t.l7}>
              전체 읽음
            </T>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {inbox.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="bell" size={28} color={t.mu} strokeWidth={1.8} opacity={0.5} />
            <T size={13.5} weight={700}>
              아직 받은 알림이 없어요
            </T>
            <T size={12} color={t.mu} leading={1.6} style={styles.emptyBody}>
              팝업을 찜하면 마감 사흘 전에 하나 보내드립니다.
            </T>
            <Pressable
              onPress={() => navigation.navigate('PushPreview')}
              style={[styles.previewBtn, { borderColor: t.ln }]}
            >
              <T size={12} weight={700} color={t.mu}>
                알림이 어떻게 오는지 미리보기
              </T>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {inbox.map((item) => (
              <Row key={item.id} item={item} onPress={() => {
                markRead(item.id);
                if (item.popupId !== null) navigation.navigate('Detail', { id: item.popupId });
              }} />
            ))}
          </View>
        )}

        <T size={11} weight={700} color={t.mu} dim={0.7} style={styles.sectionTitle}>
          어떤 알림을 받을까요
        </T>
        <View style={[styles.settings, { backgroundColor: t.sf, borderColor: t.ln }]}>
          {KINDS.map((k, i) => (
            <View
              key={k.kind}
              style={[styles.setting, { borderBottomColor: i === KINDS.length - 1 ? 'transparent' : t.ln }]}
            >
              <View style={styles.grow}>
                <T size={12.5} weight={700}>
                  {k.label}
                </T>
                <T size={11} color={t.mu} dim={0.8} leading={1.45} style={styles.settingWhen}>
                  {k.when}
                </T>
              </View>
              <Toggle on={settings[k.kind]} onChange={() => setSetting(k.kind, !settings[k.kind])} />
            </View>
          ))}
        </View>

        <T size={11} color={t.mu} dim={0.75} leading={1.6} style={styles.rule}>
          알림은 {QUIET_END_HOUR.toString().padStart(2, '0')}:00~{QUIET_START_HOUR}:00 에만 보냅니다.
          하루 최대 {MAX_PER_DAY}건, 같은 팝업은 24시간에 1건.
        </T>

        {inbox.length > 0 ? (
          <Pressable
            onPress={() => navigation.navigate('PushPreview')}
            style={[styles.previewBtn, { borderColor: t.ln, alignSelf: 'center' }]}
          >
            <T size={12} weight={700} color={t.mu}>
              알림 미리보기
            </T>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const { t } = useTheme();
  /* 안 읽음은 라임을 아주 옅게 깐다 — 시안의 color-mix(in srgb, var(--l3) 8%, var(--sf)). */
  const bg = item.read ? t.sf : tintOnSurface(t, 8);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: bg, borderColor: item.read ? t.ln : t.l4 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: item.read ? t.mp : t.sft }]}>
        <Icon name={ICON_OF[item.kind]} size={16} color={item.read ? t.mu : t.l7} />
      </View>
      <View style={styles.grow}>
        <T size={13} weight={800} numberOfLines={1}>
          {item.title}
        </T>
        <T size={11.5} color={t.mu} dim={0.9} leading={1.5} style={styles.rowBody}>
          {item.body}
        </T>
        <T size={9.5} weight={600} color={t.mu} dim={0.55} numeric style={styles.rowAt}>
          {formatAt(item.at)}
        </T>
      </View>
      {!item.read ? <View style={[styles.dot, { backgroundColor: t.l5 }]} /> : null}
    </Pressable>
  );
}

/** "방금" · "12분 전" · "8월 29일". 하루가 넘으면 날짜로 — 상대 시간은 그때부터 세기 어렵다. */
function formatAt(at: number): string {
  const diff = Date.now() - at;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  unread: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  readAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  list: { gap: 8, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 11, padding: 12, borderRadius: 14, borderWidth: 1 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowBody: { marginTop: 3 },
  rowAt: { marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 44 },
  emptyBody: { textAlign: 'center' },

  sectionTitle: { marginBottom: 10 },
  settings: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1 },
  settingWhen: { marginTop: 3 },

  rule: { marginTop: 12 },
  previewBtn: { marginTop: 14, minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
});
