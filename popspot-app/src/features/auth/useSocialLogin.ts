import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { create } from 'zustand';

import type { AuthResult } from './authApi';
import {
  clearPendingNonce,
  exchangeSocialCode,
  newNonce,
  parseAuthDeepLink,
  readPendingNonce,
  socialErrorMessage,
  startSocialLogin,
  writePendingNonce,
  type SocialProvider,
} from './socialAuth';

/**
 * 소셜 로그인의 진행 상태 — <b>앱 전체가 하나를 본다.</b>
 *
 * <h3>왜 화면 안의 useState 로는 안 되는가</h3>
 *
 * <p>브라우저에 다녀오는 동안 앱은 뒤로 밀리고, 안드로이드는 메모리가 모자라면 <b>그 사이에 앱을
 * 죽인다.</b> 그러면 로그인 화면은 사라지고 앱은 스플래시부터 다시 시작하는데, 딥링크는 그래도
 * 도착한다. 상태를 로그인 화면이 들고 있으면 그 코드를 받을 사람이 아무도 없다.
 *
 * <p>그래서 <b>듣는 곳은 앱 뿌리</b>({@link useSocialLoginListener}, {@code App.tsx})고, 결과는
 * 여기 모인다. 로그인 화면은 그것을 보고 안내만 한다 — 화면이 없어도 토큰은 저장된다.
 * {@code useRecentStore} 를 만든 것과 같은 이유다.
 */

interface SocialLoginStore {
  /** 어느 제공자로 진행 중인가. null 이면 진행 중이 아니다. */
  pending: SocialProvider | null;
  /** 교환 요청이 날아가 있는 중. 이 동안에는 취소 타이머가 손대지 않는다. */
  exchanging: boolean;
  /** 끝난 결과. 화면이 읽고 {@link consume} 으로 비운다. */
  result: AuthResult | null;
  /**
   * 결과가 생긴 시각.
   *
   * <p>콜드 스타트로 로그인이 끝나면 그것을 읽을 화면이 없다 — 결과가 스토어에 남는다. 나중에
   * 사용자가 로그인 화면을 열면 <b>이미 로그인된 상태에서</b> 옛 결과가 튀어나와 이유 없이 홈으로
   * 튕기거나 묵은 오류가 뜬다. 화면이 오래된 결과를 무시할 수 있게 시각을 함께 둔다.
   */
  resultAt: number;
  start: (provider: SocialProvider) => Promise<void>;
  /** 딥링크가 왔다. 우리 주소가 아니면 아무 일도 하지 않는다. */
  handleUrl: (url: string) => Promise<void>;
  /** 결과를 읽었다고 알린다. 같은 결과로 두 번 이동하지 않게. */
  consume: () => void;
  /** 브라우저에서 그냥 돌아왔다 — 기다림을 푼다. */
  cancel: () => void;
}

/**
 * 이미 처리한 딥링크.
 *
 * <p>딥링크로 <b>꺼져 있던 앱이 켜지면</b> 안드로이드의 {@code getIntent()} 가 그 인텐트를 계속
 * 들고 있어서 {@code Linking.getInitialURL()} 이 앱이 사는 내내 같은 값을 돌려준다. 훅이 다시
 * 마운트될 때마다 읽으면 <b>이미 쓴 코드를 또 교환</b>해 "이미 사용되었습니다" 가 뜬다.
 *
 * <p>콜백 페이지의 "앱이 열리지 않으면 여기를 누르세요" 링크를 자동 이동이 이미 성공한 뒤에
 * 누르는 경우도 같은 주소가 두 번 배달된다.
 *
 * <p>모듈 스코프에 두는 이유는 그것이 앱 프로세스와 수명이 같기 때문이다 — 스토어 상태에 두면
 * 되살아날 수 있고, 화면 상태에 두면 리마운트마다 초기화된다.
 */
const handledUrls = new Set<string>();

export const useSocialLoginStore = create<SocialLoginStore>((set, get) => ({
  pending: null,
  exchanging: false,
  result: null,
  resultAt: 0,

  start: async (provider) => {
    const nonce = newNonce();
    /* 저장소에도 남긴다 — 브라우저에 다녀오는 동안 앱이 죽으면 메모리의 값이 사라지는데,
       그때 확인을 건너뛰면 그 창이 곧 공격면이 된다. */
    await writePendingNonce(nonce);
    set({ pending: provider, result: null });
    const opened = await startSocialLogin(provider, nonce);
    if (!opened) {
      await clearPendingNonce();
      set({
        pending: null,
        result: { kind: 'error', message: '브라우저를 열지 못했어요.' },
        resultAt: Date.now(),
      });
    }
  },

  handleUrl: async (url) => {
    const parsed = parseAuthDeepLink(url);
    if (!parsed) return;

    /* 같은 주소를 두 번 처리하지 않는다 — 콜드 스타트에서 getInitialURL 이 계속 같은 값을 준다. */
    if (handledUrls.has(url)) return;
    handledUrls.add(url);

    /**
     * <b>내가 시작한 로그인인가.</b> 이 확인이 이 흐름의 유일한 자물쇠다.
     *
     * <p>없으면 악성 앱조차 필요 없다 — 피해자가 아무 웹페이지에서 링크 하나를 누르면
     * {@code popspot://auth?code=<공격자 코드>} 가 앱에 배달되고, 앱은 그것을 자기 로그인으로 알고
     * <b>공격자 계정으로 조용히 갈아탄다.</b> 그 뒤 찜·스탬프·코스가 전부 공격자 계정에 쌓인다.
     * 웹 콜백이 {@code ?token=} 경로를 지운 것과 같은 위협이다.
     *
     * <p>그래서 <b>짝이 맞지 않으면 버린다.</b> 시작한 적이 없어도 버린다 — "확인할 값이 없으니
     * 통과" 는 자물쇠가 없는 것과 같다.
     */
    const expected = await readPendingNonce();
    if (expected === null || parsed.nonce !== expected) return;
    await clearPendingNonce();

    if (parsed.kind === 'error') {
      set({
        pending: null,
        exchanging: false,
        result: { kind: 'error', message: socialErrorMessage(parsed.reason) },
        resultAt: Date.now(),
      });
      return;
    }

    /* 코드는 60초짜리다. 여기서 바로 교환한다 — 화면이 떠 있기를 기다리면 그 사이에 만료된다. */
    set({ exchanging: true });
    const result = await exchangeSocialCode(parsed.code);
    set({ pending: null, exchanging: false, result, resultAt: Date.now() });
  },

  consume: () => set({ result: null, resultAt: 0 }),

  cancel: () => {
    /* 교환이 날아가 있는 중이면 손대지 않는다. 3G 에서 교환이 유예 시간을 넘기면 버튼이 먼저
       풀려 사용자가 한 번 더 누르고, 브라우저가 또 열린다. */
    if (get().exchanging) return;
    if (get().pending) set({ pending: null });
  },
}));

/**
 * 앱이 다시 뜬 뒤 딥링크를 기다리는 시간.
 *
 * <p>딥링크는 보통 앱이 활성화되는 것과 거의 동시에 온다. 1.5초는 느린 기기에서도 넉넉하면서,
 * 취소한 사람이 버튼이 풀리기를 기다린다고 느끼지 않는 선이다.
 */
const RETURN_GRACE_MS = 1500;

/**
 * 결과가 이보다 오래되면 화면이 무시한다.
 *
 * <p>콜드 스타트로 로그인이 끝난 뒤 한참 있다가 로그인 화면을 연 사람에게, 그때의 결과로 화면을
 * 움직이면 이유 없이 튕긴 것으로 보인다.
 */
export const RESULT_FRESH_MS = 2 * 60 * 1000;

/**
 * 딥링크를 듣는 <b>단 한 곳</b>. {@code App.tsx} 에서 한 번만 부른다.
 *
 * <p>두 경로가 다 필요하다:
 * <ul>
 *   <li>{@code getInitialURL} — 앱이 <b>꺼져 있다가</b> 딥링크로 깨어난 경우. 이벤트는 이미 지나갔다.
 *   <li>{@code addEventListener} — 앱이 <b>떠 있는 채</b> 뒤로 밀려 있던 경우. 실제로는 대개 이쪽이다.
 * </ul>
 *
 * <p><b>개발 빌드에서는 콜드 경로가 안 된다.</b> {@code expo-dev-launcher} 가 앱 번들이 뜨기 전의
 * 인텐트를 가로채 개발자 런처 화면을 띄운다 — 우리 코드까지 오지 않는다. 릴리스·preview 빌드에서는
 * 정상이므로 <b>개발 빌드에서 안 된다고 코드를 고치지 말 것.</b>
 *
 * <p>그리고 {@code AppState} — 사용자가 카카오 화면에서 뒤로 가기를 누르거나 브라우저를 그냥 닫으면
 * <b>딥링크는 영영 오지 않는다.</b> 그때 화면이 계속 "로그인 중" 으로 돌면 사용자는 앱이 멈춘 줄
 * 안다. 앱이 다시 활성화됐는데 잠시 뒤에도 결과가 없으면 기다림을 푼다.
 */
export function useSocialLoginListener(): void {
  const handleUrl = useSocialLoginStore((s) => s.handleUrl);
  const cancel = useSocialLoginStore((s) => s.cancel);

  useEffect(() => {
    let alive = true;

    Linking.getInitialURL().then((url) => {
      if (alive && url) void handleUrl(url);
    });

    const sub = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });

    /* 돌아온 직후에는 딥링크가 아직 도착하지 않았을 수 있다. 조금 기다렸다가 그래도 아무 소식이
       없으면 취소로 본다 — 성공했다면 그 사이에 pending 이 이미 풀려 있다. */
    let timer: ReturnType<typeof setTimeout> | null = null;
    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(cancel, RETURN_GRACE_MS);
    });

    return () => {
      alive = false;
      sub.remove();
      appSub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [handleUrl, cancel]);
}
