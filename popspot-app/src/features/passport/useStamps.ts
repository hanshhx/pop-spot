import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { t as translate } from '@/lib/i18n';
import { isPopupStamped, stampErrorMessageKey, type StampRow } from '@/lib/stamps';

/**
 * 방문 인증(스탬프) — 웹과 같은 문.
 *
 * <p>{@code GET /api/stamps/my?userId=} 로 받고, {@code POST /api/stamps?userId=&popupId=} 로 찍는다.
 *
 * <p>실패 사유는 이식한 {@code lib/stamps.ts} 가 고른다. 서버가 타입 있는 오류 코드가 아니라
 * 예외 메시지 문자열을 400 본문에 그대로 싣기 때문에, 문장 전체가 아니라 <b>핵심 개념어</b>로
 * 매칭한다 — 서버가 문구를 다듬어도 조용히 일반 메시지로 되돌아가지 않게.
 */

export interface Stamps {
  rows: StampRow[];
  loading: boolean;
  /** 인증 실패 사유. 성공하면 null. */
  error: string | null;
  /** 이 팝업을 이미 인증했는가. */
  has: (popupId: number) => boolean;
  /** 찍는다. 성공하면 true. */
  add: (popupId: number) => Promise<boolean>;
  reload: () => void;
}

export function useStamps(userId: string | null): Stamps {
  const [rows, setRows] = useState<StampRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    let alive = true;
    setLoading(true);

    apiFetch(`/api/stamps/my?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!alive || !res.ok) return;
        const data = (await res.json()) as StampRow[];
        if (alive && Array.isArray(data)) setRows(data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [userId, nonce]);

  const add = useCallback(
    async (popupId: number): Promise<boolean> => {
      if (!userId) {
        setError('로그인이 필요해요.');
        return false;
      }
      setError(null);

      try {
        const res = await apiFetch(
          `/api/stamps?userId=${encodeURIComponent(userId)}&popupId=${popupId}`,
          { method: 'POST' },
        );
        if (res.ok) {
          setNonce((n) => n + 1);
          return true;
        }
        /* 400 본문은 규칙을 설명하는 한국어 문장이다. 그 문장으로 어느 규칙인지 고른다. */
        setError(translate(stampErrorMessageKey(await res.text().catch(() => ''))));
        return false;
      } catch {
        setError('서버에 연결하지 못했습니다.');
        return false;
      }
    },
    [userId],
  );

  const has = useCallback((popupId: number) => isPopupStamped(rows, popupId), [rows]);

  return { rows, loading, error, has, add, reload: () => setNonce((n) => n + 1) };
}
