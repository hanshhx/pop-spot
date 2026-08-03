import { useSyncExternalStore } from 'react';

export const EXTERNAL_MEDIA_CONSENT_KEY = 'popspot:externalMediaConsentVersion';
export const EXTERNAL_MEDIA_CONSENT_VERSION = '1.2';
const CONSENT_CHANGE_EVENT = 'popspot:external-media-consent-change';

export function hasExternalMediaConsent(): boolean {
  try {
    return localStorage.getItem(EXTERNAL_MEDIA_CONSENT_KEY) === EXTERNAL_MEDIA_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function grantExternalMediaConsent(): void {
  try {
    localStorage.setItem(EXTERNAL_MEDIA_CONSENT_KEY, EXTERNAL_MEDIA_CONSENT_VERSION);
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  } catch {
    // 저장소 접근이 막힌 환경에서는 호출한 화면이 현재 탭의 선택을 별도로 처리한다.
  }
}

export function revokeExternalMediaConsent(): void {
  try {
    localStorage.removeItem(EXTERNAL_MEDIA_CONSENT_KEY);
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  } catch {
    // 저장된 값이 없거나 브라우저가 저장소 접근을 막은 경우에는 할 일이 없다.
  }
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

export function useExternalMediaConsent(): boolean {
  return useSyncExternalStore(subscribe, hasExternalMediaConsent, () => false);
}
