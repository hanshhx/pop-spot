import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const home = readFileSync(join(process.cwd(), 'app/HomeClient.tsx'), 'utf8');

/**
 * <b>마이팝은 저장한 것을 먼저 보여준다. 계정 상태는 나중에.</b>
 *
 * <p><b>왜 지키나.</b> 2026-09-06 이전의 순서는 내 계정 → 활동 기록(스탬프 0/12 · 리뷰 0) →
 * 등급("기록 시작") → 최근 본 팝업 → 찜한 팝업이었다. 저장한 것을 보러 온 사람이 만나는 첫
 * 화면이 <b>회원 탈퇴 버튼과 0점짜리 실적</b>이었고, 정작 찾아온 것이 다섯 번째였다.
 * 계획서 §4.5 가 "계정 상태를 보러 오는 화면" 이라고 지적한 것이 이 순서다.
 *
 * <p><b>왜 이렇게 검사하나.</b> 순서는 <b>조용히 되돌아간다.</b> 카드 하나를 추가하거나 블록을
 * 옮기다 보면 자연스럽게 어긋나는데, 타입도 시험도 통과하고 화면에 오류도 없다. 사람이 MY 탭을
 * 열어 보기 전까지 아무도 모른다 — 그리고 개발 중에는 대개 로그인한 채로 보므로, 회원 화면의
 * 순서야말로 눈에 덜 띈다.
 *
 * <p>같은 이유로 쓰인 선례가 옆에 있다: {@code GuestWishlistMigrationPlacement.test.ts},
 * {@code ReturnToPlacement.test.ts}.
 */

/** MY 탭 카드 안에서 그 조각이 시작하는 위치. 없으면 -1 이 아니라 실패한다. */
const at = (needle: string): number => {
  const i = home.indexOf(needle);
  expect(i, `찾지 못함: ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe('마이팝 순서', () => {
  it('찜한 팝업이 계정·활동 기록·등급보다 먼저 온다', () => {
    const wishlist = at('{/* Wishlist */}');
    expect(wishlist).toBeLessThan(at("{t('my.account')}"));
    expect(wishlist).toBeLessThan(at("{t('my.activity')}"));
    expect(wishlist).toBeLessThan(at("{t('my.grade')}"));
  });

  it('찜한 팝업이 최근 본 팝업보다 먼저 온다', () => {
    expect(at('{/* Wishlist */}')).toBeLessThan(at('<RecentVisitsCard />'));
  });

  /*
   * 이 기기의 것(찜·최근 본)이 먼저, 계정의 것(코스·의견·계정·실적)이 나중 — 같은 선을 따른다.
   */
  it('이 기기의 것이 계정의 것보다 먼저 온다', () => {
    expect(at('<RecentVisitsCard />')).toBeLessThan(at("{t('course.saved')}"));
  });

  /*
   * 맨 끝은 숨긴 것이 아니라 마지막에 두는 것이다(§4.5 5번 "찾기 쉽게 제공함").
   * 지워지면 이 시험이 못 찾아서 실패한다.
   */
  it('계정 설정은 사라지지 않았다 — 순서만 바뀌었다', () => {
    expect(at("{t('my.account')}")).toBeGreaterThan(-1);
    expect(at("{t('my.withdraw')}")).toBeGreaterThan(-1);
  });

  /*
   * 계정·실적은 로그인한 사람에게만 그린다. 이게 풀리면 계정이 없는 사람에게 "이메일 정보 없음"
   * 과 회원 탈퇴 버튼이 다시 보인다 — 지울 계정이 없는 사람에게 탈퇴를 권하는 화면이다.
   */
  it('계정·실적은 여전히 로그인한 사람에게만 그린다', () => {
    const account = at("{t('my.account')}");
    const guard = home.lastIndexOf('{user && (', account);
    expect(guard, '계정 블록을 감싸는 user 조건이 없다').toBeGreaterThan(-1);
    expect(account - guard).toBeLessThan(3000);
  });
});
