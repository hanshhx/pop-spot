/** 'YYYY-MM-DD' 에서 화면에 쓰는 'MM-DD' 만 잘라낸다. 값이 없으면 null. */
function short(date: string | null | undefined): string | null {
  const trimmed = date?.trim();
  return trimmed ? trimmed.slice(5) : null;
}

/**
 * 정보 바의 「기간」 칸에 쓸 문자열.
 *
 * <p>예전엔 <b>종료일이 없으면 통째로 "-"</b> 였다. 그런데 라이브 1,181행 중 619행(52%)이
 * 시작일만 있고 종료일이 없다 — 즉 절반의 상세가 "2026-09-15 에 연다" 는 것을 <b>알면서도</b>
 * 기간을 모른다고 찍고 있었다. 같은 화면의 상태 배지는 그 시작일로 "오픈 예정" 을 계산해
 * 내걸고 있었으므로, 한 화면이 스스로 모순됐다.
 *
 * <p>이 파일 위쪽 주석이 이미 같은 원칙을 적어 뒀다 — <i>"빈 칸을 만드느니 칸을 없애고, 남은
 * 자리는 진짜 값(시작일)에 쓴다"</i>. 코드가 그 주석을 따르지 않았을 뿐이다.
 *
 * <p>"-" 는 <b>둘 다 없을 때만</b> 쓴다. 한쪽만 아는 것은 모르는 것이 아니다.
 */
export function periodText(
  openDate: string | null | undefined,
  closeDate: string | null | undefined,
): string {
  const open = short(openDate);
  const close = short(closeDate);
  if (open && close) return `${open} ~ ${close}`;
  if (open) return `${open} ~`;
  if (close) return `~ ${close}`;
  return '-';
}
