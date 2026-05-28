-- v2.21-S10 — Spotify OAuth 사용자별 토큰 저장.
-- 각 popspot 사용자가 자기 Spotify 계정 (Premium/Free) 을 OAuth 로 연결하면 여기 저장.
-- access_token / refresh_token 은 AES-256 GCM 으로 암호화된 Base64 문자열.
-- 회원 탈퇴 시 ON DELETE CASCADE 로 자동 정리 (PIPA / Spotify 약관 의무).
CREATE TABLE IF NOT EXISTS spotify_auth (
    id                       BIGSERIAL PRIMARY KEY,
    user_id                  VARCHAR(255) NOT NULL UNIQUE,
    spotify_user_id          VARCHAR(255) NOT NULL,
    access_token_encrypted   TEXT NOT NULL,
    refresh_token_encrypted  TEXT NOT NULL,
    expires_at               TIMESTAMP NOT NULL,
    is_premium               BOOLEAN NOT NULL DEFAULT false,
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_spotify_auth_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_spotify_auth_expires
    ON spotify_auth(expires_at);
