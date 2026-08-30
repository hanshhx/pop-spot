import { describe, expect, it } from 'vitest';

import {
  checkEmail,
  checkNickname,
  checkPassword,
  checkPasswordMatch,
  checkPhone,
  normalizePhone,
} from './validate';

describe('checkEmail', () => {
  it('평범한 주소를 통과시킨다', () => {
    expect(checkEmail('popspot@naver.com').ok).toBe(true);
    expect(checkEmail('  popspot@naver.com  ').ok).toBe(true);
  });

  it('@ 나 도메인이 빠지면 막는다', () => {
    expect(checkEmail('popspot').ok).toBe(false);
    expect(checkEmail('popspot@').ok).toBe(false);
    expect(checkEmail('popspot@naver').ok).toBe(false);
    expect(checkEmail('').ok).toBe(false);
  });
});

describe('checkNickname', () => {
  it('한글·영문·숫자 2~8자를 통과시킨다', () => {
    expect(checkNickname('성수러버').ok).toBe(true);
    expect(checkNickname('popspot').ok).toBe(true);
    expect(checkNickname('성수2가').ok).toBe(true);
  });

  /* 자모 범위까지 열어 두면 이런 것이 통과한다. 목록에서 이름으로 읽히지 않는다. */
  it('완성되지 않은 한글 자모는 막는다', () => {
    expect(checkNickname('ㅋㅋㅋ').ok).toBe(false);
    expect(checkNickname('ㄱㅏ').ok).toBe(false);
  });

  it('길이를 글자 수로 센다 — 한글 두 글자는 통과', () => {
    expect(checkNickname('성수').ok).toBe(true);
    expect(checkNickname('성').ok).toBe(false);
    expect(checkNickname('성수동에사는사람').ok).toBe(true); // 8자
    expect(checkNickname('성수동에사는사람들').ok).toBe(false); // 9자
  });

  it('공백과 기호는 막는다', () => {
    expect(checkNickname('성수 러버').ok).toBe(false);
    expect(checkNickname('pop!spot').ok).toBe(false);
  });
});

describe('checkPhone', () => {
  it('하이픈을 지우고 본다 — 고칠 수 있는 것은 고친다', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(checkPhone('010-1234-5678').ok).toBe(true);
    expect(checkPhone('01012345678').ok).toBe(true);
  });

  it('010 이 아니거나 자릿수가 다르면 막는다', () => {
    expect(checkPhone('0111234567').ok).toBe(false);
    expect(checkPhone('0101234567').ok).toBe(false);
    expect(checkPhone('010123456789').ok).toBe(false);
    expect(checkPhone('').ok).toBe(false);
  });
});

describe('checkPassword', () => {
  it('세 종류를 모두 갖춘 8~20자를 통과시킨다', () => {
    expect(checkPassword('popspot!2026').ok).toBe(true);
  });

  /* 무엇이 빠졌는지 말해 주지 않으면 사용자는 전부를 다시 짠다. */
  it('빠진 종류를 이름으로 알려준다', () => {
    expect(checkPassword('popspot2026').message).toContain('특수문자');
    expect(checkPassword('popspot!!!!').message).toContain('숫자');
    expect(checkPassword('1234567!').message).toContain('영문');
  });

  it('길이를 먼저 본다', () => {
    expect(checkPassword('a1!').message).toContain('8~20자');
    expect(checkPassword(`${'a1!'.repeat(7)}b`).ok).toBe(false);
  });
});

describe('checkPasswordMatch', () => {
  it('같으면 통과하고 그 사실을 말한다', () => {
    const result = checkPasswordMatch('popspot!2026', 'popspot!2026');
    expect(result.ok).toBe(true);
    expect(result.message).toBe('비밀번호가 일치합니다.');
  });

  it('다르면 막는다', () => {
    expect(checkPasswordMatch('popspot!2026', 'popspot!2027').ok).toBe(false);
    expect(checkPasswordMatch('popspot!2026', '').ok).toBe(false);
  });
});
