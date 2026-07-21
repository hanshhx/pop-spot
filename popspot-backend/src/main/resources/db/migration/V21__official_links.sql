-- 팝업 공식 사이트·예약 링크.
--
-- 배경: 상세 페이지의 sourceUrl 은 자동수집의 원 출처(블로그 원문)라, 방문자를 팝업 자체의 공식 정보·예약으로
-- 보내기엔 맞지 않는다. 별도 필드로 두고, 크롤은 스니펫에 명시적으로 있을 때만 채운다(없으면 null, 환각 금지).
--
-- 주의: 운영은 현재 dev 프로파일(ddl-auto=update)로 떠 Flyway 가 실행되지 않으므로 Hibernate 가 컬럼을 자동 추가한다.
-- 이 마이그레이션은 prod 프로파일(ddl-auto=validate) 전환·새 환경용이며, 엔티티 PopupStore 의 매핑과 일치해야 한다.
ALTER TABLE popup_store ADD COLUMN IF NOT EXISTS official_url TEXT;
ALTER TABLE popup_store ADD COLUMN IF NOT EXISTS reservation_url TEXT;
