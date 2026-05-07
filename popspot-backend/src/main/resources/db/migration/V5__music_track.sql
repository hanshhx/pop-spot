-- ===========================================================
-- V5: 음악 → 팝업 매칭 기능 (POP-SPOT Music Radio)
-- ===========================================================
-- 흐름: iTunes 검색 → YouTube 영상 매칭 → Groq 분위기 분석
-- → popup_store.tags 매칭 → 추천 5곳

CREATE TABLE music_track (
    id                  BIGSERIAL PRIMARY KEY,
    itunes_track_id     VARCHAR(50) UNIQUE NOT NULL,
    artist_name         VARCHAR(200) NOT NULL,
    track_name          VARCHAR(300) NOT NULL,
    album_name          VARCHAR(300),
    artwork_url         TEXT,
    artwork_url_hires   TEXT,           -- 1000x1000 고화질
    preview_url         TEXT,           -- iTunes 30초 미리듣기 (백업용)
    youtube_video_id    VARCHAR(20),    -- 풀 재생용
    youtube_channel     VARCHAR(200),
    is_official         BOOLEAN DEFAULT FALSE,  -- VEVO/Topic/공식 여부
    mood_tags           TEXT,           -- JSON 배열 ["청량","여름",...]
    duration_ms         INTEGER,
    play_count          INTEGER DEFAULT 0,
    last_searched_at    TIMESTAMP,
    cached_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_music_track_itunes_id ON music_track(itunes_track_id);
CREATE INDEX idx_music_track_play_count ON music_track(play_count DESC);
CREATE INDEX idx_music_track_artist ON music_track(LOWER(artist_name));

-- ----- 사용자별 음악 청취 기록 (음악 패스포트용) -----
CREATE TABLE user_music_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         VARCHAR(50) NOT NULL,
    track_id        BIGINT NOT NULL REFERENCES music_track(id),
    played_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    matched_popup_id BIGINT,        -- 그 곡으로 추천받은 팝업 (NULL 가능)
    UNIQUE(user_id, track_id, played_at)
);

CREATE INDEX idx_user_music_history_user ON user_music_history(user_id, played_at DESC);
CREATE INDEX idx_user_music_history_track ON user_music_history(track_id);
