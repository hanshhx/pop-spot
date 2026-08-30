import * as SecureStore from 'expo-secure-store';

import type { User } from '@/types/popup';

/**
 * 로그인 토큰을 어디에 두는가 — 웹 {@code lib/authStorage.ts} 의 앱 판.
 *
 * <p>웹은 localStorage 를 쓴다. 앱은 <b>SecureStore</b> 다. 브라우저의 localStorage 는 그 사이트만
 * 읽지만, 앱의 일반 저장소(AsyncStorage)는 안드로이드에서 <b>평문 파일</b>이라 루팅된 기기나 백업
 * 파일에서 그대로 읽힌다. 토큰 하나로 그 계정의 찜·코스·스탬프가 전부 열린다.
 *
 * <p>계절 설정 같은 것은 AsyncStorage 에 그대로 둔다 — 새어 나가도 잃을 것이 없는 값에까지 암호화
 * 저장소를 쓰면 읽기가 느려지고 실패 경로만 늘어난다.
 */

const TOKEN_KEY = 'popspot-token';
const REFRESH_KEY = 'popspot-refresh-token';

/**
 * 로그인한 사람의 프로필.
 *
 * <p>토큰과 같은 암호화 저장소에 둔다. 닉네임만이면 평문이라도 상관없지만 이메일이 함께 오고,
 * 그건 계정을 특정하는 값이다.
 *
 * <p><b>왜 저장해야 하는가.</b> 찜과 스탬프 API 가 {@code userId} 를 쿼리로 받는다
 * ({@code /api/wishlist/:userId}, {@code /api/stamps?userId=}). 토큰만 들고 있으면 그 값을 알 수
 * 없어서, 앱을 다시 켤 때마다 찜 목록을 못 부른다.
 */
const USER_KEY = 'popspot-user';

/**
 * SecureStore 는 실패할 수 있다.
 *
 * <p>기기 잠금이 없는 안드로이드나 일부 제조사 롬에서 키체인이 안 열린다. 그때 예외를 그대로
 * 던지면 <b>앱이 로그인 화면에서 죽는다</b> — 토큰을 못 읽는 것은 "로그인 안 됨" 이지 오류가
 * 아니다. 읽기는 null 로, 쓰기는 조용히 넘어간다.
 */
async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* 저장하지 못하면 다음 실행에 다시 로그인한다. 앱을 멈출 이유는 아니다. */
  }
}

export const getAuthToken = () => read(TOKEN_KEY);
export const getRefreshToken = () => read(REFRESH_KEY);
export const setAuthToken = (token: string | null) => write(TOKEN_KEY, token);
export const setRefreshToken = (token: string | null) => write(REFRESH_KEY, token);

export async function getStoredUser(): Promise<User | null> {
  const raw = await read(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    /* 예전 버전이 다른 모양으로 넣어 두었을 수 있다. 화면이 죽는 것보다 다시 로그인하는 편이 낫다. */
    return null;
  }
}

export const setStoredUser = (user: User | null) =>
  write(USER_KEY, user === null ? null : JSON.stringify(user));

/** 로그아웃 — 셋 다 지운다. 하나만 지우면 다음 실행에 반쪽 상태로 되살아난다. */
export async function clearAuthToken(): Promise<void> {
  await Promise.all([write(TOKEN_KEY, null), write(REFRESH_KEY, null), write(USER_KEY, null)]);
}
