import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

/**
 * "지금 어때요?" — 원터치 대기 제보. 웹 {@code components/popup/NowWait.tsx} 의 앱 판.
 *
 * <p><b>시안의 "예상 대기 12분" 은 이 자리에 못 온다.</b> 백엔드에 예측 모델이 없다. 있는 것은
 * 방문자가 직접 누른 3단계 제보({@code GET/POST /api/popups/:id/wait})이고, 그게 이 화면이 말할 수
 * 있는 전부다. 없는 숫자를 그럴듯하게 적어 두면 그 팝업 앞에 선 사람이 그 숫자로 판단한다.
 *
 * <p>실시간 채팅은 동시 접속자가 있어야 돌지만 이건 <b>혼자 눌러도 다음 방문자에게 남는</b> 비동기
 * 신호다. 글쓰기가 없어 문턱이 거의 0 이고, 로그인 없이 게스트도 누를 수 있다.
 */

/** 시안·웹이 함께 쓰는 3단계. 색은 화면이 정한다. */
export const WAIT_LEVELS = [
  { value: 0, label: '바로 입장', detail: '바로 입장 가능' },
  { value: 1, label: '조금 대기', detail: '조금 기다려요' },
  { value: 2, label: '많이 대기', detail: '많이 기다려요' },
] as const;

export interface WaitStatus {
  /** 최근 제보들의 대표 단계. 제보가 없으면 null. */
  level: number | null;
  count: number;
  updatedAt: string | null;
}

/**
 * 익명 방문자 id — 중복 제보만 막기 위한 것.
 *
 * <p>웹 {@code lib/visitorId.ts} 와 같은 목적이다. 계정이 아니라 <b>이 기기</b>를 뜻하고, 서버는
 * 이걸로 같은 사람이 같은 팝업에 연달아 제보하는 것만 막는다. 로그인 없이 참여할 수 있어야 하므로
 * 계정 id 를 쓸 수 없다.
 */
const VISITOR_KEY = 'popspot-visitor-id';

async function visitorId(): Promise<string> {
  const saved = await AsyncStorage.getItem(VISITOR_KEY).catch(() => null);
  if (saved) return saved;
  /* 난수 두 조각을 붙인다. 서버가 유일성을 요구하지 않고 중복 제보만 걸러내므로 이 정도면 된다. */
  const next = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(VISITOR_KEY, next).catch(() => {});
  return next;
}

export interface WaitReport {
  status: WaitStatus | null;
  /** 이번 방문에서 이미 눌렀는가. 서버가 막기 전에 화면에서 먼저 잠근다. */
  sent: boolean;
  loading: boolean;
  report: (level: number) => void;
}

export function useWaitReport(popupId: number): WaitReport {
  const [status, setStatus] = useState<WaitStatus | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/popups/${popupId}/wait`);
      /* 204 는 "아직 제보 없음" 이다. 오류가 아니라 상태라서 빈 값으로 둔다. */
      setStatus(res.status === 204 ? null : ((await res.json()) as WaitStatus));
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [popupId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    /* load 를 그대로 부르지 않는다 — 화면을 떠난 뒤에 응답이 오면 사라진 컴포넌트에 상태를 쓴다.
       다른 팝업으로 넘어갔을 때 이전 팝업의 제보가 잠깐 보이는 것도 같은 원인이다. */
    (async () => {
      try {
        const res = await apiFetch(`/api/popups/${popupId}/wait`);
        const next = res.status === 204 ? null : ((await res.json()) as WaitStatus);
        if (alive) setStatus(next);
      } catch {
        if (alive) setStatus(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [popupId]);

  const report = useCallback(
    (level: number) => {
      if (sent) return;
      setSent(true);
      visitorId()
        .then((id) =>
          apiFetch(`/api/popups/${popupId}/wait`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, visitorId: id }),
          }),
        )
        .then(() => load())
        /* 실패해도 되돌리지 않는다 — 다시 누르게 하면 서버에 두 번 들어갈 수 있다. */
        .catch(() => {});
    },
    [popupId, sent, load],
  );

  return { status, sent, loading, report };
}
