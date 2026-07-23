-- 크롤 키워드 순회 커서 — "다음 회차가 어느 키워드부터 시작할지".
--
-- 배경: 무료 티어의 분당 토큰(TPM 8000)이 한 호출로 거의 소진돼, 크롤은 회차마다 앞쪽 키워드 몇 개만 처리하고 멈춘다.
-- 커서가 없으면 다음 회차도 같은 앞부분부터 시작해, 뒤쪽 키워드는 검색만 되고 LLM 해석에는 영영 도달하지 못했다
-- (실제로 390개 중 앞 5개만 반복 처리됐다). 회차마다 커서를 전진시켜 전체 키워드를 며칠에 걸쳐 순회한다.
-- 커서는 서비스 전체에서 하나뿐이라 id=1 단일 행으로 관리한다.
--
-- 과거 dev/update 운영에서 Hibernate가 만든 테이블과도 호환된다.
-- prod/validate 전환 및 새 환경을 위한 마이그레이션이며, 엔티티 CrawlCursor 의
-- 매핑과 반드시 일치해야 한다.
CREATE TABLE IF NOT EXISTS crawl_cursor (
    id INTEGER PRIMARY KEY,
    keyword_cursor INTEGER NOT NULL DEFAULT 0
);

-- 단일 행을 미리 심어 둔다. 서비스가 없으면 upsert 로 만들지만, validate 환경에서 초기 상태를 명확히 한다.
INSERT INTO crawl_cursor (id, keyword_cursor) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
