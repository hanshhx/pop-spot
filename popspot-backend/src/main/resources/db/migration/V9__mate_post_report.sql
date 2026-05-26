-- v2.18.1 — 동행 게시글 신고 누적 + 자동 차단.
-- report_count: 신고 누적 수. is_hidden: 임계값 도달로 자동 숨김 처리된 글.
-- 목록 조회 쿼리에서 is_hidden=true row 를 제외하면 사용자 화면에서 사라진다.

ALTER TABLE mate_post ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mate_post ADD COLUMN is_hidden    BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN mate_post.report_count IS '신고 누적 수. 3건 도달 시 is_hidden 자동 true.';
COMMENT ON COLUMN mate_post.is_hidden    IS '신고 누적 또는 admin 차단으로 사용자 화면에서 숨김 처리된 글.';
