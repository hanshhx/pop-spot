ALTER TABLE users
    ADD COLUMN IF NOT EXISTS agreed_privacy_version VARCHAR(10),
    ADD COLUMN IF NOT EXISTS policy_consent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS age_14_verified_at TIMESTAMP;

COMMENT ON COLUMN users.agreed_privacy_version IS
    '마지막으로 동의한 개인정보 처리방침 버전';
COMMENT ON COLUMN users.policy_consent_at IS
    '약관 및 개인정보 처리방침 동의를 서버가 확정한 시각';
COMMENT ON COLUMN users.age_14_verified_at IS
    '이용자가 만 14세 이상임을 확인한 시각(생년월일은 저장하지 않음)';
