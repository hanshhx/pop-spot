-- =================================================================
-- V1__baseline.sql — Flyway 베이스라인 (no-op)
-- =================================================================
-- 운영 DB에 이미 ddl-auto=update 로 만들어진 스키마가 있다고 가정하고
-- "이 시점이 v1" 이라고 마킹만 합니다.
--
-- 새 VM 에 신규 DB 를 만들 때는 이 V1 으로는 테이블이 안 생깁니다. 두 가지 옵션:
--   (A) 첫 부팅에만 SPRING_PROFILES_ACTIVE=dev (ddl-auto=update) 로 띄워서 스키마 생성 →
--       이후 SPRING_PROFILES_ACTIVE=prod (validate) 로 영구 전환
--   (B) 또는 V1__baseline.sql 본문에 CREATE TABLE 들을 직접 작성한 뒤 prod 로 부팅
--
-- 어느 쪽이든 application-prod.properties 의 spring.flyway.baseline-on-migrate=true
-- 덕분에 운영 DB 에서 충돌 없이 베이스라인이 잡힙니다.
--
-- 이후 모든 스키마 변경은 V2__add_xxx.sql, V3__alter_xxx.sql 형태로 추가하세요.
-- =================================================================

-- 안전한 no-op (Flyway 가 이 파일을 실행해도 에러 없음)
SELECT 1;
