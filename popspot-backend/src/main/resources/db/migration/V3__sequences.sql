-- =================================================================
-- V3__sequences.sql
-- =================================================================
-- 운영 검증(validate) 모드에서 누락된 시퀀스로 부팅 실패하는 사고 방어.
-- Orders 엔티티는 @SequenceGenerator(sequenceName="orders_seq") 사용.
-- PopupStore 엔티티는 @SequenceGenerator(sequenceName="popup_store_seq") 사용.
-- =================================================================

CREATE SEQUENCE IF NOT EXISTS orders_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS popup_store_seq START WITH 1 INCREMENT BY 1;
