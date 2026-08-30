import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Symbol } from '@/components/layout/Symbol';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { openPopups, usePopups } from '@/features/popup/usePopups';
import { daysUntilEnd } from '@/lib/dday';
import { type NotifyDecision, type NotifyKind } from '@/lib/notifyRules';
import { kstTodayStart } from '@/lib/popupSlices';
import { useNotifyStore } from '@/store/useNotifyStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 알림 미리보기 — 시안 13.
 *
 * <p><b>이건 앱이 그리는 화면이 아니다.</b> 시안 13은 안드로이드 <b>잠금화면</b>이고, 앱은 남의
 * 잠금화면을 그릴 수 없다. 그런데 시안이 이 화면에 담은 것은 잠금화면 자체가 아니라 <b>세 가지 알림
 * 문구를 눌러 비교하는 일</b>이고, 그건 앱 안에서 할 수 있다.
 *
 * <p>그래서 두 가지를 함께 둔다 — 잠금화면 모양의 <b>미리보기</b>와, 그 문구를 <b>진짜로 보내 보는</b>
 * 버튼. 발송은 {@code lib/notifyRules.ts} 의 규칙을 그대로 지난다. 규칙에 걸리면 왜 안 갔는지 말해
 * 준다(조용한 시간·하루 상한). 그게 이 화면의 진짜 쓸모다 — 규칙이 실제로 어떻게 도는지 눈으로 본다.
 *
 * <p>문구는 <b>지금 데이터로</b> 만든다. 시안처럼 "무드살롱 성수" 를 박아 두면, 알림 문구를 다듬는
 * 사람이 실제 팝업 이름 길이에서 어떻게 줄바꿈되는지 볼 수 없다.
 */

const KINDS: { kind: NotifyKind; chip: string; tagBg: string; tagFg: string }[] = [
  { kind: 'wishClosing', chip: '찜 D-3 마감', tagBg: '#ffe7ef', tagFg: '#97083d' },
  { kind: 'courseNext', chip: '코스 다음 장소', tagBg: '#e7fbc2', tagFg: '#3a570a' },
  { kind: 'weekly', chip: '주간 요약', tagBg: '#efeaff', tagFg: '#341c95' },
];

const TAG_TEXT: Record<NotifyKind, string> = {
  wishClosing: '찜 마감',
  courseNext: '코스 진행',
  weekly: '주간 요약',
  newPopup: '새 팝업',
};

/** 규칙에 걸렸을 때 사람이 읽을 말. */
const REASON_TEXT: Record<Exclude<NotifyDecision, { send: true }>['reason'], string> = {
  off: '이 알림이 꺼져 있어요. 알림 센터에서 켜면 보냅니다.',
  quietHours: '지금은 조용한 시간(21시~9시)이라 보내지 않았어요.',
  dailyLimit: '오늘 보낼 수 있는 두 건을 이미 채웠어요.',
  samePopupCooldown: '같은 팝업으로는 24시간에 한 번만 보냅니다.',
};

export default function PushPreviewScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { popups } = usePopups();
  const notify = useNotifyStore((s) => s.notify);

  const [kind, setKind] = useState<NotifyKind>('wishClosing');
  const [result, setResult] = useState<string | null>(null);

  const today = useMemo(() => kstTodayStart(), []);
  const open = useMemo(() => openPopups(popups, today), [popups, today]);

  /** 마감이 가장 가까운 곳 — 찜 알림이 실제로 가리킬 팝업. */
  const closing = useMemo(() => {
    const withEnd = open
      .map((p) => ({ popup: p, left: daysUntilEnd(p.endDate, today) }))
      .filter((x): x is { popup: (typeof open)[number]; left: number } => x.left !== null && x.left >= 0);
    return withEnd.sort((a, b) => a.left - b.left)[0] ?? null;
  }, [open, today]);

  const message = buildMessage(kind, closing, open.length);
  const meta = KINDS.find((k) => k.kind === kind)!;

  const send = async () => {
    const decision = await notify({ ...message, kind, popupId: message.popupId });
    setResult(decision.send ? '보냈어요. 알림함에도 남았습니다.' : REASON_TEXT[decision.reason]);
  };

  const clock = useMemo(() => {
    const now = new Date();
    return `${now.getHours()}:${`${now.getMinutes()}`.padStart(2, '0')}`;
  }, []);

  return (
    <View style={styles.root}>
      {/* 잠금화면을 흉내 낸 바탕. 앱이 그리는 화면이 아니라는 것을 알 수 있도록 어둡게 둔다. */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#141414' }]} />

      <Pressable
        onPress={navigation.goBack}
        accessibilityLabel="뒤로"
        style={[styles.back, { top: insets.top + 8 }]}
      >
        <Icon name="arrowLeft" size={19} color="rgba(255,255,255,.8)" strokeWidth={2.2} />
      </Pressable>

      <View style={[styles.clock, { top: insets.top + 44 }]}>
        <T size={56} weight={400} em={-0.03} color="rgba(255,255,255,.9)">
          {clock}
        </T>
        <T size={13} weight={600} color="rgba(255,255,255,.6)">
          {formatToday()}
        </T>
      </View>

      <View style={[styles.cardWrap, { top: insets.top + 150 }]}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.appIcon}>
              <Symbol height={12} />
            </View>
            <T size={11.5} weight={700} color="#3f3f3f">
              팝스팟
            </T>
            <T size={11} color="#6f6f6f">
              · 방금
            </T>
            <View style={styles.grow} />
            <View style={[styles.tag, { backgroundColor: meta.tagBg }]}>
              <T size={9} weight={700} color={meta.tagFg} numeric>
                {TAG_TEXT[kind]}
              </T>
            </View>
          </View>

          <T size={14.5} weight={800} em={-0.01} leading={1.3} color="#0a0a0a">
            {message.title}
          </T>
          <T size={12.5} leading={1.55} color="#3f3f3f" style={styles.cardBody}>
            {message.body}
          </T>

          <View style={styles.cardActions}>
            <Pressable onPress={send} style={styles.primaryAction}>
              <T size={12.5} weight={800} color="#0a0a0a">
                실제로 보내 보기
              </T>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.secondaryAction}>
              <T size={12.5} weight={700} color="#3f3f3f">
                알림 설정
              </T>
            </Pressable>
          </View>
        </View>

        {result ? (
          <View style={styles.result}>
            <T size={11.5} color="#3f3f3f" leading={1.5}>
              {result}
            </T>
          </View>
        ) : null}
      </View>

      <View style={[styles.kinds, { bottom: insets.bottom + 34 }]}>
        <T size={9.5} weight={700} em={0.1} color="rgba(255,255,255,.5)" numeric style={styles.kindsTitle}>
          알림 종류 미리보기
        </T>
        <View style={styles.kindRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k.kind}
              onPress={() => {
                setKind(k.kind);
                setResult(null);
              }}
              style={[styles.kind, kind === k.kind && { backgroundColor: t.l3 }]}
            >
              <T size={11.5} weight={700} color={kind === k.kind ? '#0a0a0a' : '#fff'} style={styles.kindLabel}>
                {k.chip}
              </T>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * 지금 데이터로 문구를 만든다.
 *
 * <p>찜 알림은 <b>실제로 마감이 가까운 팝업</b>을 가리킨다. 가리킬 것이 없으면 그 사실을 말한다 —
 * 예시 이름을 지어내면 눌러 보고 없는 팝업으로 간다.
 */
function buildMessage(
  kind: NotifyKind,
  closing: { popup: { id: number; name: string }; left: number } | null,
  openCount: number,
): { title: string; body: string; popupId: number | null } {
  if (kind === 'courseNext') {
    return {
      title: '다음 장소로 이동할 시간이에요',
      body: '코스에 담은 다음 팝업까지 도보로 이어집니다. 길찾기를 이어서 켜 보세요.',
      popupId: null,
    };
  }
  if (kind === 'weekly') {
    return {
      title: `이번 주 서울에 팝업 ${openCount.toLocaleString()}곳이 열려 있어요`,
      body: '지난주에 담아 둔 코스가 있으면 이어서 돌아볼 수 있습니다.',
      popupId: null,
    };
  }
  if (!closing) {
    return {
      title: '마감이 가까운 찜이 아직 없어요',
      body: '팝업을 찜해 두면 끝나기 사흘 전에 하나만 알려드립니다.',
      popupId: null,
    };
  }
  return {
    title: `찜한 팝업이 ${closing.left === 0 ? '오늘' : `${closing.left}일 뒤`} 마감돼요`,
    body: `${closing.popup.name} · 지금이 마지막 기회예요.`,
    popupId: closing.popup.id,
  };
}

function formatToday(): string {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },

  back: { position: 'absolute', left: 12, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  clock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },

  cardWrap: { position: 'absolute', left: 12, right: 12, gap: 8 },
  card: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.96)',
    padding: 14,
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.3,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  appIcon: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  cardBody: { marginTop: 5 },
  cardActions: { flexDirection: 'row', gap: 7, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: 'rgba(10,10,10,.08)' },
  primaryAction: { flex: 1, minHeight: 38, borderRadius: 999, backgroundColor: '#c2f970', alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { flex: 1, minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(10,10,10,.14)', alignItems: 'center', justifyContent: 'center' },

  result: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,.85)', paddingHorizontal: 13, paddingVertical: 10 },

  kinds: { position: 'absolute', left: 16, right: 16 },
  kindsTitle: { marginBottom: 9 },
  kindRow: { flexDirection: 'row', gap: 6 },
  kind: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  kindLabel: { textAlign: 'center' },
});
