/**
 * 가입 입력 검사 — 시안 04 가 화면 아래 적어 둔 조건을 코드로.
 *
 * <p>화면 파일이 아니라 여기 두는 이유는 두 가지다. 하나는 테스트 — 정규식은 눈으로 봐서 맞는지
 * 알 수 없고, 특히 한글 범위는 손으로 짜면 자모({@code ㄱㅏ})가 통과하기 쉽다. 다른 하나는 재사용 —
 * 프로필 수정 화면이 같은 닉네임 규칙을 쓴다.
 *
 * <p>돌려주는 것은 <b>불리언이 아니라 사유</b>다. "형식이 올바르지 않습니다" 는 무엇을 고쳐야
 * 하는지 알려주지 않는다.
 */

export interface Check {
  ok: boolean;
  /** 화면 아래 안내 문구. 통과했을 때도 말할 것이 있으면 채운다. */
  message: string;
}

const pass = (message: string): Check => ({ ok: true, message });
const fail = (message: string): Check => ({ ok: false, message });

/** 이메일 — 로컬@도메인.최상위. 서버가 다시 검사하므로 여기서는 오타를 잡는 정도만 한다. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkEmail(value: string): Check {
  const email = value.trim();
  if (!email) return fail('이메일을 입력해 주세요.');
  return EMAIL.test(email) ? pass('') : fail('이메일 주소를 다시 확인해 주세요.');
}

/**
 * 닉네임 — 한글·영문·숫자 2~8자.
 *
 * <p><b>완성형 한글만 받는다</b>({@code 가-힣}). 자모 범위({@code ㄱ-ㅎㅏ-ㅣ})까지 열어 두면
 * {@code ㅋㅋㅋ} 나 조합 중인 글자가 그대로 저장되고, 그런 이름은 목록에서 읽히지 않는다.
 *
 * <p>길이는 <b>글자 수</b>로 센다. 바이트로 세면 한글 두 글자가 6바이트라 "2자 이상" 을 통과하는데,
 * 사용자가 세는 단위는 글자다.
 */
const NICKNAME = /^[가-힣a-zA-Z0-9]{2,8}$/;

export function checkNickname(value: string): Check {
  const name = value.trim();
  if (!name) return fail('이름(닉네임)을 입력해 주세요.');
  return NICKNAME.test(name)
    ? pass('')
    : fail('한글, 영문, 숫자 2~8자리만 가능합니다.');
}

/**
 * 휴대전화 — 010 으로 시작하는 11자리 숫자.
 *
 * <p>하이픈은 지우고 본다. 사람은 {@code 010-1234-5678} 로 입력하는데, 그걸 형식 오류라고 되돌려
 * 주면 무엇이 틀렸는지 알 수 없다 — 고칠 수 있는 것은 고친다.
 */
export function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function checkPhone(value: string): Check {
  const phone = normalizePhone(value);
  if (!phone) return fail('휴대전화 번호를 입력해 주세요.');
  return /^010\d{8}$/.test(phone)
    ? pass('')
    : fail('010으로 시작하는 11자리 숫자만 입력 가능합니다.');
}

/**
 * 비밀번호 — 영문·숫자·특수문자를 모두 포함한 8~20자.
 *
 * <p>세 종류를 <b>따로</b> 본다. 정규식 하나로 묶으면 무엇이 빠졌는지 말해 줄 수 없어서, 사용자는
 * 특수문자만 빠졌는데도 전부를 다시 짠다.
 */
export function checkPassword(value: string): Check {
  if (value.length < 8 || value.length > 20) return fail('8~20자로 입력해 주세요.');

  const missing: string[] = [];
  if (!/[a-zA-Z]/.test(value)) missing.push('영문');
  if (!/[0-9]/.test(value)) missing.push('숫자');
  if (!/[^a-zA-Z0-9]/.test(value)) missing.push('특수문자');

  if (missing.length > 0) return fail(`${missing.join(' · ')}를 함께 넣어 주세요.`);
  return pass('안전한 비밀번호입니다.');
}

export function checkPasswordMatch(password: string, confirm: string): Check {
  if (!confirm) return fail('비밀번호를 한 번 더 입력해 주세요.');
  return password === confirm ? pass('비밀번호가 일치합니다.') : fail('비밀번호가 일치하지 않습니다.');
}
