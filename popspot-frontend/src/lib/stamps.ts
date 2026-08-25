import type { MessageKey } from './i18n';

/**
 * {@code GET /api/stamps/my} 한 행 — 백엔드가 JPA 엔티티({@code Stamp})를 그대로 직렬화한
 * <b>실제</b> 응답 모양.
 *
 * <p>{@code popupStore} 는 {@code PopupStore} 엔티티이고 그 PK 필드명은 {@code id} 다(컬럼명은
 * {@code popup_id} 지만 자바 필드명은 {@code id} — {@code PopupStore.java:52}). {@code popupId} 라는
 * 필드는 어디에도 없다. 예전 프론트 타입은 {@code popupStore: { popupId: number }} 로 손으로 짜여
 * 있었는데, 타입 자체가 실제 응답과 달랐던 탓에 {@code s.popupStore.popupId === popupId} 비교는
 * 항상 {@code undefined === number} 로 늘 false 였다 — tsc 는 선언된 타입끼리만 검사하지, 그 타입이
 * 진짜 서버 응답과 맞는지는 확인해 주지 않는다.
 */
export interface StampRow {
  stampDate?: string;
  popupStore: { id: number };
}

/**
 * 이 팝업을 이미 방문 인증했는가.
 *
 * <p>날짜로 다시 거르지 않는다. 방문 인증은 <b>팝업당 평생 1회</b>다
 * ({@code StampService#rejectIfDuplicatePopup}, DB 의 {@code uk_stamp_user_popup}
 * {@code UNIQUE(user_id, popup_id)} 제약 — {@code V2__stamp_unique_constraint.sql}). "하루 1회"는
 * <b>다른 팝업</b>에서 오늘 이미 찍었는지를 막는 별개 규칙
 * ({@code StampService#rejectIfAlreadyStampedToday})이라, "이 팝업을 인증했는가"라는 질문과는
 * 무관하다. 오늘 날짜와 비교하던 예전 코드는 지난주에 찍은 스탬프까지 "미인증"으로 보여줬다.
 */
export function isPopupStamped(stamps: StampRow[], popupId: number): boolean {
  return stamps.some((s) => s.popupStore?.id === popupId);
}

/**
 * 스탬프 발급 실패(400) 응답 본문 → 보여줄 사전 키.
 *
 * <p>서버는 타입 있는 오류 코드가 아니라 {@code IllegalArgumentException.getMessage()} 문자열을
 * 그대로 400 본문에 싣는다({@code StampController#addStamp}). 문장 전체로 매칭하면 서버가 문구를
 * 다듬기만 해도(존댓말 조정, 오탈자 수정 등) 조용히 일반 메시지로 되돌아간다 — 회귀가 눈에
 * 띄지 않는다.
 *
 * <p>그래서 각 규칙의 <b>핵심 개념어</b> 하나로 매칭한다.
 *
 * <ul>
 *   <li>{@code '하루'} — "하루 한 곳" 제한({@code StampService.java:64})을 설명하는 한 어느 문장이든
 *       이 단어가 빠지기 어렵다. 규칙 자체가 "하루" 단위이기 때문이다.
 *   <li>{@code '완료'} — "이미 방문 인증이 완료된"({@code StampService.java:70}) 메시지의 핵심은
 *       <b>이미 끝났다</b>는 사실이고, '완료'는 그 사실을 가장 직접적으로 담는 말이다. '이미' 하나만
 *       보면 오탐 위험이 크다 — 아주 흔한 부사라 이 API 에 새 오류 문구가 추가돼도 우연히 걸릴 수
 *       있다. '완료'는 그보다는 이 규칙에 좁게 붙는다.
 * </ul>
 *
 * <p>둘 다 안 걸리면 일반 메시지로 폴백한다 — 서버가 새 오류 종류를 추가해도 화면이 이유를
 * 지어내지 않는다.
 */
export function stampErrorMessageKey(body: string): MessageKey {
  if (body.includes('하루')) return 'detail.stampDailyLimit';
  if (body.includes('완료')) return 'detail.stampAlreadyDone';
  return 'detail.stampFailed';
}
