-- v2.11 — 사용자 의견 보내기 게시판.
-- 게스트 작성 허용: user_id 가 NULL 인 row 는 비로그인 의견. guest_email 은 답신용 (선택 입력).

CREATE SEQUENCE feedback_seq START 1 INCREMENT 1;

CREATE TABLE feedback (
    id              BIGINT       PRIMARY KEY DEFAULT nextval('feedback_seq'),
    user_id         VARCHAR(64)  NULL,
    guest_email     VARCHAR(255) NULL,
    category        VARCHAR(32)  NOT NULL,
    title           VARCHAR(200) NOT NULL,
    content         TEXT         NOT NULL,
    status          VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    admin_reply     TEXT         NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    replied_at      TIMESTAMP    NULL
);

-- 검수 큐 조회용 (어드민이 PENDING 만 빠르게 뽑을 때).
CREATE INDEX idx_feedback_status_created ON feedback (status, created_at DESC);

-- 내 의견 목록 조회용.
CREATE INDEX idx_feedback_user_created ON feedback (user_id, created_at DESC);
