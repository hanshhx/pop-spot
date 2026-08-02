-- 관리자 행위 감사 로그 — 누가 · 무엇을 · 어디에 · 성공했는가.
--
-- 지금 관리자 행위의 흔적은 애플리케이션 로그 몇 줄뿐이다. 팝업 영구 삭제, 채팅 일괄 삭제,
-- 회원 목록 전량 조회가 아무 기록 없이 일어난다. 관리자 토큰이 샜을 때 "무엇이 지워졌는가" 를
-- 답할 방법이 없고, 애플리케이션 로그는 10MB × 7개로 롤링되므로 며칠이면 사라진다 —
-- 사고를 인지하는 시점에는 이미 없다.
--
-- <b>이 표 자체가 개인정보 저장소가 되면 안 된다.</b> 감사 로그는 이 서비스에서 보존 기간이
-- 가장 길다. 여기 넣은 개인정보는 가장 오래 남는다. 그래서 다음은 저장하지 않는다:
--   요청 본문 · 토큰 · IP(전체든 일부든) · 이메일 · 닉네임 · User-Agent · 쿼리스트링 전문.
-- 대상은 언제나 내부 식별자(팝업 id, 회원 UUID)로만 가리킨다.

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,

    -- 행위자. USERS.USER_ID(UUID) 이거나, 스케줄러가 남긴 경우 'SYSTEM' 이다.
    --
    -- 이름이 admin_id 가 아니라 actor_id 인 이유: 권한 없는 일반 회원이 관리자 주소를 두드린
    -- 403 도 여기 기록된다. admin_id 라고 부르면 다음 사람이 "여기 있는 건 다 관리자" 라고
    -- 착각한다. 관리자 여부는 이 칼럼이 아니라 success/status_code 로 읽어야 한다.
    --
    -- USERS 와 FK 를 걸지 않는다 — 계정이 지워져도 그 계정이 한 일은 남아야 한다.
    -- FK 를 걸면 탈퇴가 감사 기록을 함께 지운다.
    actor_id VARCHAR(64) NOT NULL,

    -- "POST /api/admin/popups/{id}/approve" — 실제 URI 가 아니라 매핑 <b>패턴</b>이다.
    -- URI 를 그대로 넣으면 경로에 박힌 id 가 action 문자열로 새어, "이 동작이 몇 번
    -- 일어났나" 같은 집계가 불가능해진다.
    action VARCHAR(120) NOT NULL,

    target_type VARCHAR(30) NOT NULL,

    -- 팝업 id 같은 숫자이거나 회원 UUID 라 타입이 섞인다. 숫자 칼럼으로 못 잡아 문자열이다.
    -- 저장 전에 숫자 또는 UUID 형식인지 <b>반드시 검사한다</b> — 경로 변수는 결국 사용자가
    -- 보낸 문자열이라, 검사 없이 넣으면 이메일이나 임의 문자열이 그대로 박힐 수 있다.
    target_id VARCHAR(64),

    success BOOLEAN NOT NULL DEFAULT TRUE,

    -- 성공/실패 두 값만으로는 "권한 부족(403)" 과 "대상 없음(404)" 과 "서버 오류(500)" 를
    -- 구분할 수 없다. 사후 조사에서 가장 먼저 묻는 것이 그 구분인데, 그때 애플리케이션 로그는
    -- 이미 롤링돼 없다. 2바이트로 그 질문에 답할 수 있고 개인정보도 아니다.
    status_code SMALLINT,

    -- 허용 목록 파라미터(limit/size/status/days/retryMissing)와 일괄 처리 건수만 담는다.
    -- 자유 문자열이 아니다 — 자유롭게 두면 결국 아무거나 들어온다.
    detail VARCHAR(200),

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 기본 조회는 "최근 순 목록" 이고, 보관기간 초과분 삭제(created_at < 기준일)도 같은 인덱스를
-- 탄다. 하나로 두 용도를 덮는다.
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at);

-- "이 계정이 무엇을 했나" — 토큰 유출이 의심될 때 가장 먼저 던지는 질문. 전체 로그아웃을
-- 누른 직후 반드시 훑게 되는 경로다.
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log (actor_id, created_at);

-- "이 팝업을 누가 지웠나" — 위와 반대 방향의 추적.
--
-- 배치성 작업은 target_id 가 NULL 이라 인덱스에 낭비가 생긴다. 부분 인덱스
-- (WHERE target_id IS NOT NULL)로 만들면 더 작지만, 그건 엔티티의 @Index 로 선언할 수 없어
-- dev(ddl-auto)와 prod(Flyway)의 스키마가 어긋난다. 오늘 Flyway 사고의 원인이 정확히 그
-- 종류의 불일치였다. 조금 낭비하더라도 양쪽이 같은 것을 만들게 둔다.
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log (target_type, target_id, created_at);
