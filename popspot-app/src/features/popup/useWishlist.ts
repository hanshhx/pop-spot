import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { WishlistItem } from '@/types/popup';

/**
 * 찜 — 웹과 같은 문을 쓴다.
 *
 * <p>{@code GET /api/wishlist/:userId} 로 목록을, {@code POST}·{@code DELETE
 * /api/wishlist/:userId/:popupId} 로 켜고 끈다.
 *
 * <h3>왜 낙관적으로 바꾸는가</h3>
 *
 * <p>하트는 <b>누르는 순간 반응해야 한다.</b> 서버 응답을 기다렸다 칠하면 지하철에서 1~2초 동안
 * 아무 일도 안 일어난 것처럼 보이고, 사람은 한 번 더 누른다 — 그러면 켰다 껐다가 되어 결국 안
 * 찜한 상태로 끝난다.
 *
 * <p>그래서 먼저 바꾸고 실패하면 되돌린다. 되돌릴 때는 <b>조용히 넘기지 않는다</b> — 찜한 줄
 * 알았는데 안 되어 있으면 마감 알림이 오지 않고, 그건 사용자가 알아챌 방법이 없다.
 */

export interface Wishlist {
  /** 찜한 팝업 id. */
  ids: Set<number>;
  loading: boolean;
  /** 되돌린 이유. 화면이 한 줄로 보여준다. */
  error: string | null;
  has: (popupId: number) => boolean;
  toggle: (popupId: number) => void;
}

/** 로그인하지 않았을 때. 훅을 조건부로 부를 수 없으므로 빈 값을 돌려준다. */
const EMPTY: Omit<Wishlist, 'has' | 'toggle'> = { ids: new Set(), loading: false, error: null };

export function useWishlist(userId: string | null): Wishlist {
  const [ids, setIds] = useState<Set<number>>(EMPTY.ids);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIds(new Set());
      return;
    }
    let alive = true;
    setLoading(true);

    apiFetch(`/api/wishlist/${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!alive || !res.ok) return;
        const rows = (await res.json()) as WishlistItem[];
        if (alive && Array.isArray(rows)) setIds(new Set(rows.map((r) => r.popupId)));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = useCallback(
    (popupId: number) => {
      if (!userId) return;

      const wasOn = ids.has(popupId);
      setError(null);

      /* 먼저 바꾼다. 실패하면 아래에서 되돌린다. */
      setIds((prev) => {
        const next = new Set(prev);
        if (wasOn) next.delete(popupId);
        else next.add(popupId);
        return next;
      });

      apiFetch(`/api/wishlist/${encodeURIComponent(userId)}/${popupId}`, {
        method: wasOn ? 'DELETE' : 'POST',
      })
        .then((res) => {
          if (res.ok) return;
          throw new Error(String(res.status));
        })
        .catch(() => {
          setIds((prev) => {
            const next = new Set(prev);
            if (wasOn) next.add(popupId);
            else next.delete(popupId);
            return next;
          });
          setError(wasOn ? '찜을 풀지 못했어요.' : '찜하지 못했어요. 잠시 후 다시 눌러 주세요.');
        });
    },
    [userId, ids],
  );

  const has = useCallback((popupId: number) => ids.has(popupId), [ids]);

  return { ids, loading, error, has, toggle };
}
