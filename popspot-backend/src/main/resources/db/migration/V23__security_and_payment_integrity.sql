-- 인증 철회, 동행 채팅 DTO, 서버 준비 결제를 위한 운영 스키마 변경.
-- 운영은 ddl-auto=validate이므로 애플리케이션 교체 전에 Flyway가 이 파일을 적용해야 한다.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS account_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE mate_chat_message
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'TALK',
    ADD COLUMN IF NOT EXISTS file_url VARCHAR(2048);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS status VARCHAR(20);

-- 기존 결제는 이미 완료된 주문이므로 PAID로 보존한다.
UPDATE orders SET status = 'PAID' WHERE status IS NULL;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'PREPARED';
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;

-- 과거 merchant_uid 결손 행은 기존 결제 식별자를 건드리지 않고 내부 레거시 키만 부여한다.
UPDATE orders
SET merchant_uid = 'legacy_' || order_id
WHERE merchant_uid IS NULL OR BTRIM(merchant_uid) = '';
ALTER TABLE orders ALTER COLUMN merchant_uid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_orders_imp_uid
    ON orders (imp_uid)
    WHERE imp_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_orders_merchant_uid
    ON orders (merchant_uid);
