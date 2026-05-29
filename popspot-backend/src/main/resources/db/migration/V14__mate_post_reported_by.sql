-- v2.22 — 신고자 중복 방지.
-- 기존 report_count(V9) 는 누가 신고했는지 추적하지 않아, 로그인 유저 1명이 같은 글을
-- 임계값(3)만큼 반복 신고하면 혼자서 자동 숨김을 트리거할 수 있었다(어뷰징).
-- joinedUsers 와 동일하게 콤마 구분 문자열로 신고자 ID 명단을 보관해 1인 1신고를 보장한다.
-- (정규화(join 테이블) 대신 기존 코드 컨벤션과 일관성 + 단순성 우선.)
ALTER TABLE mate_post ADD COLUMN IF NOT EXISTS reported_by VARCHAR(2000) DEFAULT '';

COMMENT ON COLUMN mate_post.reported_by IS '신고한 사용자 ID 콤마 구분 명단. 중복 신고 방지용.';
