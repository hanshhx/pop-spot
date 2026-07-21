-- 사진 출처 구분 — 실사진(CRAWLED·USER)과 스톡(PEXELS)을 나눠, 랜딩·상세가 스톡·플레이스홀더를 실제 사진처럼
-- 보여주지 않게 한다.
--
-- 배경: 지금까지 POPUP_IMAGE 를 저장하는 경로는 Pexels 커버 백필 하나뿐이었다(크롤은 이미지를 저장하지 않아
-- 크롤 팝업은 이미지 없이 상수 폴백으로 떨어진다). 따라서 기존 행은 전부 Pexels 출처로 보고 PEXELS 로 백필한다.
--
-- 주의: 운영은 현재 dev 프로파일(ddl-auto=update)로 떠 Flyway 가 실행되지 않으므로 Hibernate 가 컬럼을 자동 추가한다.
-- 이 마이그레이션은 prod 프로파일(ddl-auto=validate) 전환·새 환경용이며, 엔티티 PopupImage.photoOrigin 과 일치해야 한다.
ALTER TABLE popup_image ADD COLUMN IF NOT EXISTS photo_origin VARCHAR(20);

-- 기존 이미지의 출처를 소급 표기. NULL 인 행만 채워 이미 값이 있는 행은 건드리지 않는다.
UPDATE popup_image SET photo_origin = 'PEXELS' WHERE photo_origin IS NULL;
