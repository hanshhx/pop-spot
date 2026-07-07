-- v2.31 — 익명 방문 로그. IP·개인정보 없음. 게스트/회원 방문 집계용.
CREATE TABLE IF NOT EXISTS visit_log (
    id BIGSERIAL PRIMARY KEY,
    visitor_id VARCHAR(64) NOT NULL,
    path VARCHAR(255),
    guest BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_log_created_at ON visit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_visit_log_visitor ON visit_log (visitor_id);
