-- v2.19 — 성능 인덱스 추가.
-- 자주 사용되는 쿼리 패턴에 맞춘 인덱스. 운영 트래픽 증가 대비.

-- ============================================================================
-- 1. popup_store — 지도 조회 (findAllVisible) / 어드민 검수 큐
-- ============================================================================
-- 사용 빈도 높은 쿼리:
--   WHERE status NOT IN ('PENDING','EXPIRED') AND reviewStatus IN ('AUTO_PUBLISHED','APPROVED')
--   ORDER BY view_count DESC / created_at DESC
CREATE INDEX IF NOT EXISTS idx_popup_review_status      ON popup_store (review_status);
CREATE INDEX IF NOT EXISTS idx_popup_status             ON popup_store (status);
CREATE INDEX IF NOT EXISTS idx_popup_source_type        ON popup_store (source_type);
CREATE INDEX IF NOT EXISTS idx_popup_end_date           ON popup_store (end_date);
CREATE INDEX IF NOT EXISTS idx_popup_view_count_desc    ON popup_store (view_count DESC);

-- ============================================================================
-- 2. mate_post — 동행 게시판 (정렬: isMegaphone + createdAt DESC) + 신고 필터
-- ============================================================================
-- ON 절: WHERE is_hidden = false ORDER BY is_megaphone DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_mate_post_hidden_created ON mate_post (is_hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mate_post_status         ON mate_post (status);

-- ============================================================================
-- 3. wishlist — 사용자별 + popup_store 양방향 조회
-- ============================================================================
-- 본인 위시리스트 조회 (findAllByUser_UserIdOrderByIdDesc)
-- 위시 만료 알림 cron (findWithUserAndPopupByEndDate)
-- 둘 다 popup_store_id 와 user_id 의 복합 인덱스가 효율적
CREATE INDEX IF NOT EXISTS idx_wishlist_popup_store     ON wishlist (popup_store_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id         ON wishlist (user_id);

-- ============================================================================
-- 4. music_track — 검색 / 캐시 조회
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_music_play_count_desc    ON music_track (play_count DESC);
CREATE INDEX IF NOT EXISTS idx_music_youtube_video_id   ON music_track (youtube_video_id);

-- ============================================================================
-- 5. stamp — 사용자별 스탬프 카운트
-- ============================================================================
-- countByUserId 는 자주 호출됨 (마이페이지 / 등급 계산)
CREATE INDEX IF NOT EXISTS idx_stamp_user_id            ON stamp (user_id);

-- ============================================================================
-- 6. user_music_history — 패스포트
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_music_history_user  ON user_music_history (user_id);

COMMENT ON INDEX idx_popup_review_status      IS 'v2.19 — findAllVisible 등 reviewStatus 필터에 빈번 사용';
COMMENT ON INDEX idx_mate_post_hidden_created IS 'v2.19 — 메이트 게시판 목록 (is_hidden=false 필터 + 최신순)';
COMMENT ON INDEX idx_wishlist_user_id         IS 'v2.19 — 본인 위시리스트 + 위시 만료 cron 양쪽에서 사용';
