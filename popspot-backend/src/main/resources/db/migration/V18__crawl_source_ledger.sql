-- 크롤 처리 이력 — 같은 글을 다시 LLM 에 넣지 않기 위한 대장(ledger).
--
-- 배경: 검색 API 는 같은 블로그 글을 여러 키워드 결과에 실어 주고, 하루 두 번 돌면 어제 본 글도 그대로 다시 나온다.
-- 그때마다 LLM 을 호출해 왔는데, 무료 티어에서 병목이 일일 토큰(TPD)이라 이게 가장 큰 낭비였다.
-- URL 로 먼저 걸러 "새로 올라왔거나 내용이 바뀐 글" 만 LLM 에 넘긴다.
--
-- source_url_hash : 추적 파라미터·대소문자·끝 슬래시를 정규화한 URL 의 SHA-256(hex 64자)
-- content_hash    : 제목+요약의 SHA-256. URL 이 같아도 글이 수정되면 값이 달라져 다시 처리한다.
-- status          : NEW / PROCESSED / REJECTED / RETRYABLE (엔티티 CrawlSourceLedger 의 상수와 일치)
CREATE TABLE IF NOT EXISTS crawl_source_ledger (
    id BIGSERIAL PRIMARY KEY,
    source_url_hash VARCHAR(64) NOT NULL,
    content_hash VARCHAR(64),
    source_name VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    model_name VARCHAR(100),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_processed_at TIMESTAMP
);

-- 조회 경로가 "이 URL 을 전에 처리했나" 하나뿐이라 유니크로 잡아 중복 삽입까지 함께 막는다.
CREATE UNIQUE INDEX IF NOT EXISTS uk_crawl_ledger_url ON crawl_source_ledger (source_url_hash);

-- 오래된 항목 정리·통계용.
CREATE INDEX IF NOT EXISTS idx_crawl_ledger_seen ON crawl_source_ledger (last_seen_at);
