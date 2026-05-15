'use client';

import Swal, { type SweetAlertIcon } from 'sweetalert2';

/**
 * POP-SPOT 공통 알림 헬퍼.
 *
 * <p>sweetalert2 위에 한 겹 — 모든 페이지가 같은 톤으로 쓰도록.
 *
 * @example
 *   notify('저장되었습니다');
 *   notify({ title: '오류', text: '...', icon: 'error' });
 *   await confirmAction({ title: '삭제할까요?', text: '되돌릴 수 없습니다.' });
 */

type NotifyOpts =
  | string
  | {
      title?: string;
      text?: string;
      icon?: SweetAlertIcon;
      timer?: number;
    };

const BRAND_LIME = '#C2F970';
const INK_900 = '#0A0A0A';
const DESTRUCTIVE_RED = '#EE1A64';
const NEUTRAL_GRAY = '#888888';

const DEFAULT_TOAST_TIMER_MS = 1400;
const DEFAULT_CONFIRM_TITLE = '계속할까요?';
const DEFAULT_CONFIRM_TEXT = '확인';
const DEFAULT_CANCEL_TEXT = '취소';

const normalize = (opts: NotifyOpts): Exclude<NotifyOpts, string> =>
  typeof opts === 'string' ? { text: opts } : opts;

/** 토스트형 안내. 기본 1.4초 후 자동 닫힘. */
export function notify(opts: NotifyOpts) {
  const o = normalize(opts);
  return Swal.fire({
    icon: o.icon ?? 'info',
    title: o.title,
    text: o.text,
    timer: o.timer ?? DEFAULT_TOAST_TIMER_MS,
    showConfirmButton: false,
    confirmButtonColor: BRAND_LIME,
  });
}

export function notifySuccess(opts: NotifyOpts) {
  return notify({ ...normalize(opts), icon: 'success' });
}

export function notifyError(opts: NotifyOpts) {
  const o = normalize(opts);
  return Swal.fire({
    icon: 'error',
    title: o.title ?? '오류',
    text: o.text,
    confirmButtonText: DEFAULT_CONFIRM_TEXT,
    confirmButtonColor: INK_900,
  });
}

export function notifyWarning(opts: NotifyOpts) {
  const o = normalize(opts);
  return Swal.fire({
    icon: 'warning',
    title: o.title,
    text: o.text,
    confirmButtonText: DEFAULT_CONFIRM_TEXT,
    confirmButtonColor: INK_900,
  });
}

interface ConfirmOptions {
  title?: string;
  text?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  /** true 면 확인 버튼이 빨강 (삭제 등 위험 행동). */
  destructive?: boolean;
}

/**
 * 예/아니오 확인 다이얼로그.
 *
 * @returns 사용자가 확인했으면 {@code true}, 취소했으면 {@code false}
 */
export async function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  const result = await Swal.fire({
    icon: opts.icon ?? 'question',
    title: opts.title ?? DEFAULT_CONFIRM_TITLE,
    text: opts.text,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? DEFAULT_CONFIRM_TEXT,
    cancelButtonText: opts.cancelText ?? DEFAULT_CANCEL_TEXT,
    confirmButtonColor: opts.destructive ? DESTRUCTIVE_RED : INK_900,
    cancelButtonColor: NEUTRAL_GRAY,
    reverseButtons: true,
  });
  return result.isConfirmed;
}
