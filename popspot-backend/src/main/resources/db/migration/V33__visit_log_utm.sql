-- 유입 캠페인 식별자(UTM).
--
-- referrer_host 는 "어느 사이트에서 왔나"(naver.com)만 알려 준다. 그런데 같은 인스타그램이라도
-- 프로필 링크로 온 것과 특정 게시물 광고로 온 것은 전혀 다른 이야기다 — 어떤 홍보가 실제로
-- 사람을 데려왔는지는 referrer 만으로 답할 수 없다.
--
-- 세 칸으로 나누는 이유는 UTM 이 원래 그 구조이기 때문이다:
--   source   어디서 (instagram, naver_blog)
--   medium   어떤 방식으로 (post, story, paid)
--   campaign 어떤 건으로 (summer_popup, opening_week)
-- 한 칸에 뭉치면 "인스타 전체" 와 "인스타 스토리" 를 나눠 볼 수 없다.
--
-- <b>값은 사용자가 주소창으로 보내는 것이다.</b> 무엇이든 올 수 있으므로 서비스 계층에서 길이와
-- 문자를 걸러 저장한다. 전체 쿼리스트링은 저장하지 않는다 — 거기에는 검색어나 토큰이 실릴 수 있고,
-- 개인정보 처리방침에도 "유입 캠페인 식별자" 만 적었다.
--
-- 방문당이 아니라 <b>세션의 첫 진입에만</b> 채워진다(referrer 와 같은 규칙). 페이지를 옮길 때마다
-- 실으면 많이 돌아다닌 방문자 한 명이 캠페인 순위를 통째로 흔든다.

ALTER TABLE visit_log
    ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);

-- 캠페인별 집계는 "최근 N일 + source 가 있는 것" 으로 훑는다.
-- 부분 인덱스라 UTM 없는 행(대부분)이 인덱스에서 빠져 훨씬 작아진다.
--
-- admin_audit_log 에서는 부분 인덱스를 피했는데 여기서는 쓴다. 기준이 다른 게 아니라 상황이
-- 다르다 — 그쪽은 엔티티가 @Index 로 인덱스를 선언하고 있어서, SQL 에만 부분 인덱스를 두면
-- dev(Hibernate)와 prod(Flyway)가 서로 다른 것을 만든다. visit_log 는 엔티티가 인덱스를 하나도
-- 선언하지 않고 처음부터 SQL 로만 관리해 왔으므로 갈라질 양쪽이 없다.
CREATE INDEX IF NOT EXISTS idx_visit_log_utm
    ON visit_log (utm_source, created_at)
    WHERE utm_source IS NOT NULL;
