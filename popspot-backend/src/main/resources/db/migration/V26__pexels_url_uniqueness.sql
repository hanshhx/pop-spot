-- 과거 Pexels 행에 사진 ID가 비어 있어 애플리케이션의 ID 중복 방어와 V22 고유 인덱스를
-- 동시에 우회하던 상태를 정리한다. 기존 중복은 가장 오래된 한 건만 남기고, 이후에는
-- Pexels 사진 ID와 정확한 CDN URL 두 기준을 각각 고유하게 유지한다.

UPDATE popup_image
SET photo_origin = 'PEXELS'
WHERE photo_origin IS NULL
  AND image_url LIKE '%images.pexels.com/%';

UPDATE popup_image
SET pexels_photo_id = substring(image_url FROM 'images\.pexels\.com/photos/([0-9]+)')::BIGINT,
    photo_source_url = COALESCE(
        photo_source_url,
        'https://www.pexels.com/photo/'
            || substring(image_url FROM 'images\.pexels\.com/photos/([0-9]+)')
            || '/'
    )
WHERE photo_origin = 'PEXELS'
  AND pexels_photo_id IS NULL
  AND image_url ~ 'images\.pexels\.com/photos/[0-9]+';

DELETE FROM popup_image
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               row_number() OVER (PARTITION BY pexels_photo_id ORDER BY id) AS duplicate_order
        FROM popup_image
        WHERE photo_origin = 'PEXELS'
          AND pexels_photo_id IS NOT NULL
    ) ranked
    WHERE duplicate_order > 1
);

DELETE FROM popup_image
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               row_number() OVER (PARTITION BY image_url ORDER BY id) AS duplicate_order
        FROM popup_image
        WHERE photo_origin = 'PEXELS'
          AND image_url IS NOT NULL
    ) ranked
    WHERE duplicate_order > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_popup_image_pexels_url
    ON popup_image (image_url)
    WHERE photo_origin = 'PEXELS'
      AND image_url IS NOT NULL;
