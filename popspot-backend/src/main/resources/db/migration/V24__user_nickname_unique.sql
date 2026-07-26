-- 닉네임 유일 제약 (보안 v2.41).
-- 닉네임은 ChatIdentityResolver 가 "서버가 확정한 발신자" 로 채팅에 박는 값이라, 중복이 가능하면
-- 남의 닉네임 그대로 가입해 사칭해도 사용자·운영자가 구분할 수 없다. 또 탈퇴 처리(AccountDeletionService)가
-- 닉네임 기준으로 채팅을 삭제하므로 동명이인이 있으면 남의 대화까지 복구 불가능하게 지운다.
--
-- 기존 데이터에 중복이 남아 있으면 unique index 생성이 실패하므로, 인덱스 전에 중복을 먼저 정리한다.
-- 정리 규칙: 같은 닉네임 그룹에서 "가장 먼저 가입한" 계정(created_at ASC, 동률이면 user_id ASC)이
-- 원래 닉네임을 유지하고, 나머지는 뒤에 순번을 붙인다 (운영자 → 운영자2, 운영자3 …).
-- 먼저 쓰던 사람의 표시 이름을 보존해야 기존 채팅 기록과의 어긋남이 가장 적기 때문이다.

DO $$
DECLARE
    v_round INTEGER := 0;
    v_fixed INTEGER;
BEGIN
    -- 순번을 붙인 결과가 또 다른 기존 닉네임과 겹칠 수 있어(예: '운영자2' 가 이미 있는 경우)
    -- 남는 중복이 없을 때까지 반복한다. 무한 루프 방지로 라운드 상한을 둔다.
    LOOP
        v_round := v_round + 1;

        WITH dup AS (
            SELECT user_id,
                   nickname,
                   ROW_NUMBER() OVER (
                       PARTITION BY nickname
                       ORDER BY created_at NULLS LAST, user_id
                   ) AS rn
            FROM users
            WHERE nickname IS NOT NULL
              AND BTRIM(nickname) <> ''
        )
        UPDATE users u
        SET nickname = d.nickname || d.rn::TEXT
        FROM dup d
        WHERE u.user_id = d.user_id
          AND d.rn > 1;

        GET DIAGNOSTICS v_fixed = ROW_COUNT;
        EXIT WHEN v_fixed = 0 OR v_round >= 10;
    END LOOP;

    -- 위에서 안 풀린 잔여 충돌 + 빈 문자열 닉네임은 절대 겹치지 않는 user_id 를 붙여 마무리한다.
    -- (NULL 닉네임은 Postgres unique index 가 서로 다른 값으로 취급하므로 손대지 않는다.)
    WITH dup AS (
        SELECT user_id,
               ROW_NUMBER() OVER (
                   PARTITION BY nickname
                   ORDER BY created_at NULLS LAST, user_id
               ) AS rn
        FROM users
        WHERE nickname IS NOT NULL
    )
    UPDATE users u
    SET nickname = COALESCE(NULLIF(BTRIM(u.nickname), ''), '회원') || '-' || u.user_id
    FROM dup d
    WHERE u.user_id = d.user_id
      AND d.rn > 1;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_nickname ON users (nickname);
