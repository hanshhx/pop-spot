-- 방문 안에서 <b>무엇을 했는지</b> 기록한다.
--
-- visit_log 는 "어떤 페이지를 열었다" 한 종류만 담는다. 그래서 "어떤 팝업이 실제로 눌렸나" 같은
-- 질문에 답할 수 없다 — 목록 화면에서 카드를 누른 것과 그냥 스크롤만 한 것이 구분되지 않는다.
--
-- 표를 나누는 이유: 행동 기록은 방문 기록보다 훨씬 빨리 쌓인다(한 번 방문에 클릭 여러 번). 같은
-- 표에 넣으면 기존 방문자 수·페이지뷰 집계가 행동 기록에 묻혀 느려지고, "방문 수" 와 "행동 수" 를
-- 섞어 세는 실수도 생긴다.
--
-- 개인정보 처리방침(제1조·제2조·제3조·제11조)에 이 항목들을 먼저 반영한 뒤 이 표를 만든다.
-- 순서를 뒤집으면 고지 없이 모은 구간이 생긴다 — referrer_host 가 실제로 그렇게 됐던 전례가 있다.

CREATE TABLE IF NOT EXISTS visit_event (
    id BIGSERIAL PRIMARY KEY,

    -- 브라우저가 만든 익명 값. visit_log 와 같은 값이라 두 표를 이어 볼 수 있다.
    visitor_id VARCHAR(64) NOT NULL,

    -- 한 번의 방문을 묶는 값. 30분간 활동이 없으면 브라우저가 새로 만든다.
    --
    -- 이것이 있어야 "몇 명이 왔나" 와 "몇 번 왔나" 를 구분한다. 다만 방문을 묶는다는 것은
    -- 한 사람의 행적이 이어진다는 뜻이라 식별 가능성이 올라간다 — 그래서 짧게 끊고,
    -- 회원 계정과는 연결하지 않는다(아래 guest 외에 회원 식별자를 두지 않는 이유).
    session_id VARCHAR(64),

    -- 정해진 목록 중 하나. 자유 문자열이 아니다 — 자유롭게 두면 결국 아무거나 들어오고,
    -- 그러면 집계가 불가능해지는 동시에 예상 못 한 값이 저장된다.
    event_type VARCHAR(30) NOT NULL,

    -- 대상 팝업. 행동에 대상이 없으면(단순 페이지 열람 등) 비어 있다.
    popup_id BIGINT,

    -- 그 행동이 일어난 화면. "어느 목록에서 눌렸나" 를 봐야 노출 대비 클릭을 판단할 수 있다.
    path VARCHAR(255),

    -- 회원/게스트 구분만. 회원 식별자는 저장하지 않는다.
    guest BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 기본 조회는 "최근 N일" 이고, 보관 기간 정리(created_at < 기준일)도 같은 인덱스를 탄다.
CREATE INDEX IF NOT EXISTS idx_visit_event_created ON visit_event (created_at);

-- "어떤 팝업이 많이 눌렸나" — 이 표를 만든 첫 번째 이유.
CREATE INDEX IF NOT EXISTS idx_visit_event_popup ON visit_event (popup_id, created_at);

-- "어떤 행동이 얼마나 일어났나" — 종류별 집계.
CREATE INDEX IF NOT EXISTS idx_visit_event_type ON visit_event (event_type, created_at);
