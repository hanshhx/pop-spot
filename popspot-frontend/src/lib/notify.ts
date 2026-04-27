"use client";

import Swal, { SweetAlertIcon } from "sweetalert2";

/**
 * POP-SPOT 공통 알림 헬퍼.
 * sweetalert2 위 한 겹 — 모든 페이지가 같은 톤으로 쓰도록.
 *
 *   notify("저장되었습니다")
 *   notify({ title: "오류", text: "...", icon: "error" })
 *   await confirmAction({ title: "삭제할까요?", text: "되돌릴 수 없습니다." })
 */

type NotifyOpts =
  | string
  | {
      title?: string;
      text?: string;
      icon?: SweetAlertIcon;
      timer?: number;
    };

const BRAND_LIME = "#C2F970";
const INK_900 = "#0A0A0A";

/** 단순 정보/안내. 자동으로 1.4초 후 닫힘. */
export function notify(opts: NotifyOpts) {
  const o = typeof opts === "string" ? { text: opts } : opts;
  return Swal.fire({
    icon: o.icon ?? "info",
    title: o.title,
    text: o.text,
    timer: o.timer ?? 1400,
    showConfirmButton: false,
    confirmButtonColor: BRAND_LIME,
  });
}

export function notifySuccess(opts: NotifyOpts) {
  const o = typeof opts === "string" ? { text: opts } : opts;
  return notify({ ...o, icon: "success" });
}

export function notifyError(opts: NotifyOpts) {
  const o = typeof opts === "string" ? { text: opts } : opts;
  return Swal.fire({
    icon: "error",
    title: o.title ?? "오류",
    text: o.text,
    confirmButtonText: "확인",
    confirmButtonColor: INK_900,
  });
}

export function notifyWarning(opts: NotifyOpts) {
  const o = typeof opts === "string" ? { text: opts } : opts;
  return Swal.fire({
    icon: "warning",
    title: o.title,
    text: o.text,
    confirmButtonText: "확인",
    confirmButtonColor: INK_900,
  });
}

/**
 * 예/아니오 확인.
 * @returns 사용자가 확인했으면 true, 취소했으면 false
 */
export async function confirmAction(opts: {
  title?: string;
  text?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const result = await Swal.fire({
    icon: opts.icon ?? "question",
    title: opts.title ?? "계속할까요?",
    text: opts.text,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "확인",
    cancelButtonText: opts.cancelText ?? "취소",
    confirmButtonColor: opts.destructive ? "#EE1A64" : INK_900,
    cancelButtonColor: "#888888",
    reverseButtons: true,
  });
  return result.isConfirmed;
}
