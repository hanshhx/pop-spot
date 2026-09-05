import { describe, expect, it } from 'vitest';

import { canAccessTab, USER_ONLY_TABS } from './tabAccess';

/**
 * 탭 접근 정책은 <b>가입을 유도하는 자리</b>다. 그래서 어디를 잠그는지가 곧 제품 방향이고,
 * 잘못 잠그면 방문자가 자기 것을 못 본다.
 *
 * <p>여기서 지키는 것은 하나다 — <b>계정이 있어야 의미가 생기는 것만 잠근다.</b> 코스·음악·여권은
 * 서버에 쌓이는 계정 자산이라 잠근다. 지도·일정·의견은 공개 정보라 열어 둔다. 그리고 MY 는
 * 비회원에게도 열어 둔다: 거기 보이는 찜은 <b>이 브라우저의 localStorage</b> 에만 있고 서버는
 * 그 존재조차 모르므로, 그것을 보는 데 계정도 체험 카운터도 필요하지 않다.
 */
describe('canAccessTab', () => {
  it('로그인했으면 전부 통과', () => {
    for (const tab of ['MAP', 'MY', 'COURSE', 'MUSIC', 'PASSPORT', 'SCHEDULE', 'FEEDBACK']) {
      expect(canAccessTab(tab, true, false)).toBe(true);
    }
  });

  it('게스트가 활성이면 전부 통과 — 7일 약속을 지킨다', () => {
    for (const tab of ['MAP', 'MY', 'COURSE', 'MUSIC', 'PASSPORT']) {
      expect(canAccessTab(tab, false, true)).toBe(true);
    }
  });

  /*
   * 이 검사가 이 파일의 핵심이다. 2026-09-06 이전에는 MY 가 잠겨 있어서, 자기 브라우저에 저장한
   * 찜을 보려면 "게스트로 둘러보기" 를 눌러 7일 카운터를 시작해야 했다. guestMode.ts 가 경고해
   * 둔 "사용자가 인지하지 못한 채 도는 카운터" 가 다른 문으로 다시 생기는 구조였다.
   */
  it('비회원도 MY 를 볼 수 있다 — 자기 기기에 저장한 것이라 계정이 필요 없다', () => {
    expect(canAccessTab('MY', false, false)).toBe(true);
    expect(USER_ONLY_TABS.has('MY')).toBe(false);
  });

  it('공개 정보 탭은 비회원에게 열려 있다', () => {
    for (const tab of ['MAP', 'SCHEDULE', 'FEEDBACK']) {
      expect(canAccessTab(tab, false, false)).toBe(true);
    }
  });

  /* 계정에 쌓이는 것들. 여기를 열면 로그인해야 할 이유 자체가 없어진다. */
  it('계정 자산 탭은 비회원에게 잠긴다', () => {
    for (const tab of ['COURSE', 'MUSIC', 'PASSPORT']) {
      expect(canAccessTab(tab, false, false)).toBe(false);
    }
  });

  /* 모르는 탭 이름이 실수로 잠기면 화면이 통째로 안 열린다. 기본값은 통과여야 한다. */
  it('모르는 탭은 막지 않는다', () => {
    expect(canAccessTab('WHATEVER', false, false)).toBe(true);
  });
});
