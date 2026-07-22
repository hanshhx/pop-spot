-- Pexels 사진을 실제 팝업 현장 사진과 구분해 표시하고, 한 사진이 여러 팝업에 재사용되지 않게 한다.
--
-- 운영 dev 프로파일의 과거 ddl-auto=update 스키마에는 popup_image.id의 PK·자동 증가가 누락돼 모든 ID가
-- NULL로 저장돼 있었다. 먼저 ID를 복구해야 중복 행을 안전하게 식별하고 이후 INSERT도 정상 ID를 받는다.
CREATE SEQUENCE IF NOT EXISTS popup_image_id_seq;
ALTER SEQUENCE popup_image_id_seq OWNED BY popup_image.id;
ALTER TABLE popup_image
    ALTER COLUMN id SET DEFAULT nextval('popup_image_id_seq');

SELECT setval(
    'popup_image_id_seq',
    GREATEST(COALESCE((SELECT max(id) FROM popup_image), 0) + 1, 1),
    false
);

UPDATE popup_image
SET id = nextval('popup_image_id_seq')
WHERE id IS NULL;

ALTER TABLE popup_image ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'popup_image'::regclass
          AND contype = 'p'
    ) THEN
        ALTER TABLE popup_image
            ADD CONSTRAINT popup_image_pkey PRIMARY KEY (id);
    END IF;
END
$$;

SELECT setval(
    'popup_image_id_seq',
    GREATEST(COALESCE((SELECT max(id) FROM popup_image), 0), 1),
    true
);

ALTER TABLE popup_image ADD COLUMN IF NOT EXISTS pexels_photo_id BIGINT;
ALTER TABLE popup_image ADD COLUMN IF NOT EXISTS photo_source_url TEXT;
ALTER TABLE popup_image ADD COLUMN IF NOT EXISTS photo_credit_name VARCHAR(200);
ALTER TABLE popup_image ADD COLUMN IF NOT EXISTS photo_credit_url TEXT;

-- 운영 dev 프로파일에서는 V20(Flyway)이 실행되지 않아 과거 Pexels 행의 photo_origin이 NULL일 수 있다.
-- CDN 호스트가 확실한 행만 PEXELS로 소급 분류한다.
UPDATE popup_image
SET photo_origin = 'PEXELS'
WHERE photo_origin IS NULL
  AND image_url LIKE '%images.pexels.com/%';

-- 기존 Pexels CDN URL에서 제공자 사진 ID만 확정적으로 복원한다. 작가명은 알 수 없으므로 추측해 채우지 않는다.
UPDATE popup_image
SET pexels_photo_id = substring(image_url FROM 'images\.pexels\.com/photos/([0-9]+)')::BIGINT,
    photo_source_url = 'https://www.pexels.com/photo/'
        || substring(image_url FROM 'images\.pexels\.com/photos/([0-9]+)') || '/'
WHERE photo_origin = 'PEXELS'
  AND pexels_photo_id IS NULL
  AND image_url ~ 'images\.pexels\.com/photos/[0-9]+';

-- 같은 Pexels 사진이 이미 여러 팝업에 붙어 있으면 가장 오래된 한 건만 남기고 나머지는 제거한다.
-- 제거된 팝업은 다음 사진 백필에서 새로운 고유 사진을 받는다.
DELETE FROM popup_image
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               row_number() OVER (PARTITION BY pexels_photo_id ORDER BY id) AS duplicate_order
        FROM popup_image
        WHERE pexels_photo_id IS NOT NULL
    ) ranked
    WHERE duplicate_order > 1
);

-- 과거 백필 재실행으로 팝업 하나에 서로 다른 Pexels 사진이 여러 장 쌓인 경우도 대표 한 장만 남긴다.
-- 여기서 해제된 사진 ID는 다음 백필에서 아직 사진이 없는 다른 팝업에 고유하게 재배정할 수 있다.
DELETE FROM popup_image
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               row_number() OVER (PARTITION BY popup_id ORDER BY id) AS popup_photo_order
        FROM popup_image
        WHERE photo_origin = 'PEXELS'
    ) ranked
    WHERE popup_photo_order > 1
);

-- 대표 이미지가 여러 개인 과거 데이터는 가장 오래된 한 장만 대표로 유지한다.
WITH ranked_main AS (
    SELECT id,
           row_number() OVER (PARTITION BY popup_id ORDER BY id) AS main_order
    FROM popup_image
    WHERE main_yn = 'Y'
)
UPDATE popup_image
SET main_yn = 'N'
WHERE id IN (SELECT id FROM ranked_main WHERE main_order > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uk_popup_image_pexels_photo
    ON popup_image (pexels_photo_id)
    WHERE pexels_photo_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_popup_image_main_per_popup
    ON popup_image (popup_id)
    WHERE main_yn = 'Y';
