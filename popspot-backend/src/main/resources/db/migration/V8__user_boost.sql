-- v2.12 — 동행 게시판 상단 부스트 한도 추적용.
-- 기존 megaphone 아이템 (보유 개수 차감) 모델을 폐지하고, 등급(스탬프 누적량)별 월 한도로 대체.
-- megaphone_count 컬럼은 호환을 위해 남겨두고, 본 마이그레이션에서는 부스트 한도 추적용 두 컬럼만 추가.

ALTER TABLE users ADD COLUMN boost_used_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN boost_period     VARCHAR(7) NULL;

-- boost_period 는 "YYYY-MM" 형식. 서비스 단에서 현재 월과 비교해 다르면 boost_used_count 를 0 으로 리셋.
COMMENT ON COLUMN users.boost_used_count IS '이번 달 부스트 사용 횟수. 등급별 한도와 비교.';
COMMENT ON COLUMN users.boost_period     IS 'YYYY-MM 형식. 달이 바뀌면 boost_used_count 리셋.';
