import { useCallback, useEffect, useState } from 'react';

import { getAuthToken, getStoredUser } from '@/lib/authStorage';
import type { User } from '@/types/popup';
import { logout as clearTokens } from './authApi';

/**
 * 로그인했는가.
 *
 * <p>토큰이 있느냐만 본다. <b>유효한지는 확인하지 않는다</b> — 확인하려면 서버를 불러야 하고, 앱을
 * 켤 때마다 그러면 지하철에서 로그인 화면이 잠깐씩 스친다. 만료된 토큰은 <b>실제로 쓸 때</b>
 * 401 로 드러나고, 그때 지우면 된다.
 *
 * <p>웹은 {@code AUTH_EXPIRED_EVENT} 로 그 순간을 앱 전체에 알린다. 앱에도 같은 것이 필요하지만
 * 401 을 받는 화면이 아직 여권 하나라, 그 화면이 직접 처리한다. 두 번째 화면이 생기면 이 파일로
 * 올린다.
 */

export interface AuthState {
  /** 아직 저장소를 읽는 중. 이 동안은 로그인 여부를 모른다. */
  loading: boolean;
  signedIn: boolean;
  token: string | null;
  user: User | null;
  /** 찜·스탬프 API 가 요구하는 값. 로그인하지 않았으면 null. */
  userId: string | null;
  /** 토큰을 지운다. 401 을 받은 화면이 부른다. */
  signOut: () => Promise<void>;
  /** 저장소를 다시 읽는다 — 로그인 화면에서 돌아왔을 때. */
  refresh: () => void;
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getAuthToken(), getStoredUser()])
      .then(([nextToken, nextUser]) => {
        if (!alive) return;
        setToken(nextToken);
        setUser(nextUser);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const signOut = useCallback(async () => {
    await clearTokens();
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    loading,
    signedIn: token !== null,
    token,
    user,
    userId: user?.userId ?? user?.id ?? null,
    signOut,
    refresh,
  };
}
