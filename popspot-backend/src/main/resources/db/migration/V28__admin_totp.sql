-- 관리자 2단계 인증(TOTP) 저장 칸.
--
-- 관리자 화면은 서비스 전체를 건드릴 수 있는데 지금은 이메일+비밀번호 하나로 들어간다.
-- 비밀번호가 새면 그걸로 끝이다. 인증 앱의 6자리 코드를 한 겹 더 둔다.
--
-- 이 마이그레이션만 적용해도 동작은 바뀌지 않는다. 칸이 비어 있으면 TOTP 는 꺼진 것으로
-- 취급하고, 켜는 것은 관리자가 QR 을 등록한 뒤다.

ALTER TABLE USERS
    -- 인증 앱과 공유하는 비밀키. AES-256-GCM 으로 암호화해 넣는다(TotpSecretCipher).
    --
    -- 평문으로 두면 DB 를 통째로 가져간 사람이 코드를 마음대로 만들 수 있어 2단계 인증이
    -- 사실상 1단계로 내려앉는다. 키는 DB 가 아니라 환경변수에 둔다.
    ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(512),

    -- 등록을 끝냈는가. 비밀키만 있고 이 값이 false 면 'QR 은 받았는데 아직 6자리 확인을
    -- 안 한' 상태다. 그 상태에서 로그인을 막으면 등록하다 만 사람이 잠긴다.
    ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- 복구 코드의 SHA-256 해시(쉼표 구분). 폰을 잃었을 때 쓰는 일회용 열쇠다.
    --
    -- 비밀번호와 달리 우리가 만든 고엔트로피 난수라 느린 해시(BCrypt)가 필요 없다.
    -- 원문은 발급 시점에 한 번만 보여 주고 저장하지 않는다.
    ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT,

    -- 마지막으로 성공한 시간 창. 같은 코드를 두 번 쓰지 못하게 막는다.
    --
    -- 없으면 30초 안에 코드를 가로챈 사람이 그대로 재사용할 수 있다. TOTP 는 원래
    -- 시간 창 안에서 여러 번 유효하므로, 재사용 차단은 서버가 따로 해야 한다.
    ADD COLUMN IF NOT EXISTS totp_last_used_step BIGINT;
