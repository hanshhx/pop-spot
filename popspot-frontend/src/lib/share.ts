/**
 * v2.18 — 공유 헬퍼.
 *
 * <p>Web Share API 지원 브라우저는 native 공유 시트, 미지원이면 클립보드 복사 + 토스트.
 * 외부 라이브러리 의존 없이 표준 API 만 사용.
 */

import { notifyError, notifySuccess } from './notify';

export interface ShareOptions {
  title: string;
  text?: string;
  url: string;
}

/**
 * 공유 시도. 성공 시 true, 실패 / 사용자 취소 시 false. fallback (클립보드 복사) 까지 성공 포함.
 */
export async function share(opts: ShareOptions): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  // 1. Web Share API 지원 (모바일 + 일부 데스크탑 브라우저)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
      });
      return true;
    } catch (err) {
      // AbortError 는 사용자가 명시적으로 취소한 거 — 에러로 보지 않음.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return false;
      }
      // 그 외 실패는 클립보드 복사로 fallback.
    }
  }

  // 2. Fallback — 클립보드 복사
  return copyToClipboard(opts.url);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      notifySuccess('링크가 복사되었습니다.');
      return true;
    }
    // 비 HTTPS / 옛 브라우저 — execCommand fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (ok) {
      notifySuccess('링크가 복사되었습니다.');
      return true;
    }
    notifyError('링크 복사에 실패했습니다.');
    return false;
  } catch {
    notifyError('링크 복사에 실패했습니다.');
    return false;
  }
}
