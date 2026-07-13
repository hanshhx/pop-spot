-- 봇 식별용 User-Agent 컬럼. 실제 브라우저는 UA에 mozilla + 브라우저 토큰을 담으므로,
-- 봇 키워드 없는 크롤러(SEO 랜딩을 훑는 봇 등)를 식별·필터링하는 데 쓴다. 개인 식별 불가.
ALTER TABLE visit_log ADD COLUMN IF NOT EXISTS user_agent VARCHAR(400);
