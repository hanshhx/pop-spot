import { landingStatus } from './landingStatus';

/**
 * 방문을 전제로 한 액션(길찾기 · 방문 인증 · 일정 담기)을 보여줄지.
 *
 * <p>끝난 팝업에 이 셋을 그대로 두면 <b>닫힌 곳으로 사람을 보내는 버튼</b>이 된다. 상세로는
 * 공유 링크와 직접 방문이 계속 들어오므로(딥링크 69% · 직접 23%) 종료된 페이지도 계속 열린다.
 *
 * <p>모르면 <b>보여주는</b> 쪽으로 기울인다 — 끝났다는 증거가 없는데 숨기면 날짜 없는 팝업
 * 619곳에서 액션이 통째로 사라진다. 숨기는 것은 끝난 것이 <b>증명된</b> 경우뿐이다.
 *
 * <p>{@link landingStatus} 를 그대로 쓰고 {@code popupDetailStatus.ts} 처럼 {@code parseDate} 로
 * 한 번 더 감싸지 않는다. 그쪽 가드는 "상태 배지에 '정보 없음'이라는 <b>세 번째 값</b>을 남겨야
 * 한다"는 문제를 풀려고 있었다 — {@link landingStatus} 는 그 세 번째 값이 없어 날짜 미상을 그냥
 * ongoing 으로 삼키기 때문이다. 여기는 boolean 하나만 돌려주면 되고, 날짜 미상일 때 원하는 값도
 * 정확히 같은 "보여준다(=ongoing 취급)" 다. 즉 가드가 막으려던 문제 자체가 없다 — 오히려 가드를
 * 넣으면 날짜 미상을 숨기는 쪽으로 기울어 위 문단의 619곳 규칙과 충돌한다.
 */
export function showsVisitActions(
  startDate: string | null,
  endDate: string | null,
  today: Date,
): boolean {
  return landingStatus(startDate, endDate, today).kind !== 'ended';
}
