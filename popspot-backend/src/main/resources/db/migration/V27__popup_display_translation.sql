-- 외국인 방문자를 위한 표시용 번역 칸.
--
-- 팝업 이름의 상당수가 외국 브랜드·IP를 한글로 옮겨 적은 것이라(진격의 거인, 에르메스, 니텐도)
-- 외국인이 읽어도 자기가 아는 이름인 줄 모른다. 원래 이름으로 되돌려 보여준다.
--
-- 원문(name, address)은 절대 건드리지 않는다. 지역 분류(classifyRegion)와 브랜드 매칭이
-- 그 값을 그대로 쓰기 때문에, 번역해 덮어쓰면 성수·홍대 분류가 통째로 깨진다.
-- 번역은 화면에 보여줄 때만 쓰고, 비어 있으면 한국어 원문으로 표시한다.
--
-- 확신이 낮은 번역은 채우지 않는다(NULL 유지). 틀린 이름을 자신 있게 보여주면 관광객이
-- 엉뚱한 곳으로 간다 — 검증에서 '현대백화점 → The Hyundai'(여의도 별개 매장) 같은 사례가 나왔다.

ALTER TABLE popup_store
    ADD COLUMN IF NOT EXISTS name_en VARCHAR(255),
    ADD COLUMN IF NOT EXISTS name_ja VARCHAR(255),
    ADD COLUMN IF NOT EXISTS location_en VARCHAR(255),
    ADD COLUMN IF NOT EXISTS location_ja VARCHAR(255),
    -- 번역을 시도한 시각. NULL 이면 아직 안 해 본 것이고, 값이 있는데 번역 칸이 비어 있으면
    -- '해 봤지만 확신이 없어 비워 둔 것'이다. 이 둘을 구분해야 백필이 같은 행을 무한히 다시
    -- 시도하지 않는다.
    ADD COLUMN IF NOT EXISTS translated_at TIMESTAMP;

-- 백필 대상 조회용. 아직 시도하지 않은 행부터 고른다.
CREATE INDEX IF NOT EXISTS idx_popup_store_translated_at
    ON popup_store (translated_at);
