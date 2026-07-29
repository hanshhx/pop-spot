/**
 * 번역명과 한국어 원문을 <b>함께</b> 보여주기 위한 한 벌.
 *
 * <p>실제 팝업 이름 60건으로 미리 재 봤을 때 드러난 것이 있다. 번역명은 <b>무엇인지 알려주는 데는</b>
 * 좋지만 <b>찾는 데는 못 쓴다</b> — 지도 앱에 "Knotted World" 를 넣으면 나오지 않고, 현장에서 직원에게
 * 말해도 통하지 않는다. 읽고 이해하는 문자열과 실제로 쓰는 문자열이 다르다.
 *
 * <p>그래서 둘 중 하나를 고르지 않는다. 번역명을 크게 두고 원문을 작게 남긴다.
 *
 * @param original 한국어 원문. 이 값은 어디서도 덮어쓰지 않는다 — 지역 분류가 이걸 쓴다.
 * @param translated 번역. 확신이 없으면 백엔드가 채우지 않으므로 비어 있을 수 있다.
 * @returns display 는 크게 보여줄 것, original 은 그 아래 남길 원문(번역이 없으면 null)
 */
export function bilingual(
  original: string | null,
  translated: string | null | undefined,
): { display: string | null; original: string | null } {
  const t = translated?.trim();
  // 번역이 원문과 같으면 병기하지 않는다 — 같은 줄이 위아래로 반복되면 고장으로 보인다.
  if (!t || t === original?.trim()) return { display: original, original: null };
  return { display: t, original };
}
