import { describe, expect, it } from 'vitest';

import { isPopupStamped, stampErrorMessageKey, type StampRow } from './stamps';

/**
 * <p>{@code popupStore: { id }} 모양을 쓴다 — 실제 {@code GET /api/stamps/my} 응답 그대로다.
 * {@code popupId} 필드는 어디에도 없으므로, 옛 타입({@code popupStore: { popupId } }) 을 그대로
 * 두면 이 테스트가 통과할 수 없다.
 */
describe('isPopupStamped', () => {
  it('실제 API 응답 모양(popupStore.id, popupId 필드 없음)에서 오래된 스탬프도 인증됨으로 본다', () => {
    const stamps: StampRow[] = [{ popupStore: { id: 42 }, stampDate: '2020-01-01T00:00:00' }];
    expect(isPopupStamped(stamps, 42)).toBe(true);
  });

  it('오늘 찍은 스탬프도 당연히 인증됨으로 본다', () => {
    const stamps: StampRow[] = [{ popupStore: { id: 42 }, stampDate: new Date().toISOString() }];
    expect(isPopupStamped(stamps, 42)).toBe(true);
  });

  it('해당 팝업의 스탬프가 목록에 없으면 false다', () => {
    const stamps: StampRow[] = [{ popupStore: { id: 7 }, stampDate: '2026-08-24T00:00:00' }];
    expect(isPopupStamped(stamps, 42)).toBe(false);
  });

  it('빈 목록이면 false다', () => {
    expect(isPopupStamped([], 42)).toBe(false);
  });
});

describe('stampErrorMessageKey', () => {
  it('하루 한 곳 제한 메시지는 일일 제한 키로 연결한다', () => {
    expect(
      stampErrorMessageKey('스탬프는 하루 한 곳에서만 획득 가능합니다. 내일 다시 방문해주세요.'),
    ).toBe('detail.stampDailyLimit');
  });

  it('이미 방문 인증이 완료된 팝업 메시지는 중복 인증 키로 연결한다', () => {
    expect(stampErrorMessageKey('이미 방문 인증이 완료된 팝업스토어입니다.')).toBe(
      'detail.stampAlreadyDone',
    );
  });

  it('모르는 오류 본문은 일반 실패 키로 폴백한다', () => {
    expect(stampErrorMessageKey('존재하지 않는 팝업입니다.')).toBe('detail.stampFailed');
  });

  it('빈 본문도 일반 실패 키로 폴백한다', () => {
    expect(stampErrorMessageKey('')).toBe('detail.stampFailed');
  });
});
