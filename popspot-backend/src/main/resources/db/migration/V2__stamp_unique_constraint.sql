-- =================================================================
-- V2__stamp_unique_constraint.sql
-- =================================================================
-- 동일 유저 + 동일 팝업 중복 스탬프 방지 (Race Condition DB 레벨 차단)
-- 이미 update 모드로 만들어진 환경에서는 idempotent 하게 추가.
-- =================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_stamp_user_popup'
    ) THEN
        BEGIN
            ALTER TABLE "stamp"
                ADD CONSTRAINT uk_stamp_user_popup UNIQUE ("user_id", "popup_id");
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'stamp 테이블이 아직 없음 — ddl-auto=update 첫 부팅 후 자동 생성됩니다.';
        END;
    END IF;
END $$;
