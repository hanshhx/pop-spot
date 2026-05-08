-- ===========================================================
-- V6: 음악 검색 소스를 Spotify 로 전환
-- ===========================================================
-- itunes_track_id 컬럼은 그대로 두되, Spotify 트랙 ID 도 받을 수 있게
-- "external_track_id" 로 의미를 일반화한다 (DB 컬럼은 호환을 위해 유지).
-- 새 컬럼 spotify_track_id 를 추가해서 명시적으로 구분.

ALTER TABLE music_track
    ADD COLUMN IF NOT EXISTS spotify_track_id VARCHAR(50);

-- 기존 itunes_track_id 가 NOT NULL 이라 새 데이터 삽입 시 실패하지 않게 NULLABLE 로 완화
ALTER TABLE music_track ALTER COLUMN itunes_track_id DROP NOT NULL;

-- spotify_track_id 도 unique (단, 중복 NULL 허용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_music_track_spotify_id
    ON music_track(spotify_track_id)
    WHERE spotify_track_id IS NOT NULL;
