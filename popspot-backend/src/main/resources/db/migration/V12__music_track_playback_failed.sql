-- v2.21-S7 — music_track.playback_failed_count
-- YouTube IFrame Player 의 onError (101/150 embed 차단 / 100 비공개 등) 누적 카운터.
-- 클라이언트가 재생 실패 시 POST /api/music/{id}/playback-failed 호출 → 1 증가.
-- 임계값 (기본 3) 초과 시 후속 검색 결과에서 자동 제외.
ALTER TABLE music_track
    ADD COLUMN IF NOT EXISTS playback_failed_count integer NOT NULL DEFAULT 0;

-- 임계값 초과한 트랙을 빠르게 거르기 위한 인덱스.
CREATE INDEX IF NOT EXISTS idx_music_track_playback_failed
    ON music_track (playback_failed_count);
