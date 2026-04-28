-- =================================================================
-- V4__crawler_fields.sql
-- =================================================================
-- 팝업스토어 자동수집(Naver/Kakao Search API + Gemini 정규화) 워크플로우용
-- 컬럼 추가. 기존 운영 데이터는 source_type='MANUAL', review_status=NULL 로
-- 자연스럽게 동작하도록 디폴트/NULL 허용 설계.
--
-- 정책:
--   - 외부 공개 API (Naver/Kakao 검색) 결과만 수집. 인스타/네이버블로그 본문 직접 크롤링 X
--   - 모든 수집 row 는 source_url 로 출처 링크 보유 (저작권법 인용/공정이용 방어)
--   - 권리자가 takedown 요청 시 review_status='TAKEDOWN' 으로 즉시 hide
--   - 유효기간 지난 팝업은 status='EXPIRED' 로 soft delete (이력/랭킹 분석용 보존)
-- =================================================================

ALTER TABLE popup_store
    ADD COLUMN IF NOT EXISTS source_type            VARCHAR(20)   DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS source_url             TEXT,
    ADD COLUMN IF NOT EXISTS source_name            VARCHAR(100),
    ADD COLUMN IF NOT EXISTS external_id            VARCHAR(64),
    ADD COLUMN IF NOT EXISTS confidence_score       DECIMAL(3,2),
    ADD COLUMN IF NOT EXISTS crawled_at             TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_seen_at           TIMESTAMP,
    ADD COLUMN IF NOT EXISTS review_status          VARCHAR(20),
    ADD COLUMN IF NOT EXISTS takedown_requested_at  TIMESTAMP,
    ADD COLUMN IF NOT EXISTS takedown_reason        VARCHAR(500),
    ADD COLUMN IF NOT EXISTS takedown_requester     VARCHAR(255);

-- 동일 팝업 중복 수집 방지 (이름+장소+시작일 SHA-256 해시)
CREATE UNIQUE INDEX IF NOT EXISTS uk_popup_store_external_id
    ON popup_store (external_id)
    WHERE external_id IS NOT NULL;

-- 캘린더 / 만료 스케줄러 / 검수 큐 조회 가속
CREATE INDEX IF NOT EXISTS idx_popup_store_dates
    ON popup_store (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_popup_store_review_status
    ON popup_store (review_status)
    WHERE review_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_popup_store_status
    ON popup_store (status)
    WHERE status IS NOT NULL;

-- 기존 row 정합성: source_type 이 NULL 인 레거시 행은 MANUAL 로 간주
UPDATE popup_store
   SET source_type = 'MANUAL'
 WHERE source_type IS NULL;
