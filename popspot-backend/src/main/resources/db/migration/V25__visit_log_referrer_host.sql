-- 유입 경로(리퍼러) 컬럼. 지금까지 방문 기록에 출처가 없어 "유입이 어디서 제일 많냐" 에 답할 수 없었다.
-- 전체 URL 은 저장하지 않는다 — 리퍼러 쿼리스트링에 검색어·토큰이 실릴 수 있고, IP 도 안 남기는 방침과
-- 맞춘다. 값은 도메인(search.naver.com) 또는 분류값(direct=직접 방문, internal=사이트 내 이동)만 담긴다.
-- 기존 행은 출처를 알 수 없으므로 NULL 로 두고, 집계에서 제외해 direct 를 부풀리지 않는다.
ALTER TABLE visit_log ADD COLUMN IF NOT EXISTS referrer_host VARCHAR(255);
