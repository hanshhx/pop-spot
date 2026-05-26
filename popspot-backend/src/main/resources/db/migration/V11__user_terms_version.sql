-- v2.19 — 약관 재동의 시스템.
-- 약관 / 개인정보 처리방침이 개정되면 모든 사용자에게 다음 로그인 시 재동의 강제.
-- 프론트와 백엔드가 같은 상수 (TERMS_CURRENT_VERSION) 를 공유하며, 사용자의 agreed_terms_version 이
-- 다르면 모달이 떠 다시 동의를 받는다.

ALTER TABLE users ADD COLUMN agreed_terms_version VARCHAR(10);

-- 기존 사용자는 약관 v1 에 동의한 상태로 간주 (가입 시점에 동의 받았으므로). 신규 사용자는
-- 가입 시 백엔드가 현재 버전을 박는다.
UPDATE users SET agreed_terms_version = '1.0' WHERE agreed_terms_version IS NULL;

COMMENT ON COLUMN users.agreed_terms_version IS '사용자가 마지막으로 동의한 약관 버전. 현재 버전과 다르면 재동의 모달 강제.';
