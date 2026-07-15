-- 팝업별 "지금 어때요?" 원터치 대기 제보.
-- wait_level: 0 = 바로 입장, 1 = 조금 대기, 2 = 많이 대기.
-- 실시간 채팅과 달리 혼자 눌러도 다음 방문자에게 남는 비동기 신호(참여 문턱 최소화).
-- reporter_key: 로그인 'u:userId' / 게스트 'g:익명visitorId' — 중복 제보 제한용(개인 식별 불가).
CREATE TABLE IF NOT EXISTS popup_wait_report (
    id BIGSERIAL PRIMARY KEY,
    popup_id BIGINT NOT NULL,
    wait_level INT NOT NULL,
    reporter_key VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wait_popup_created ON popup_wait_report (popup_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wait_reporter ON popup_wait_report (popup_id, reporter_key, created_at);
