package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MusicTrack;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface MusicTrackRepository extends JpaRepository<MusicTrack, Long> {

    Optional<MusicTrack> findByItunesTrackId(String itunesTrackId);

    Optional<MusicTrack> findBySpotifyTrackId(String spotifyTrackId);

    /** 가장 많이 재생된 N 곡 (인기 차트) */
    @Query(
            "SELECT m FROM MusicTrack m WHERE m.youtubeVideoId IS NOT NULL ORDER BY m.playCount DESC")
    List<MusicTrack> findTopPlayed(Pageable pageable);

    /** 무드 태그가 있는 곡 중 랜덤 1곡 (운명의 곡 룰렛) */
    @Query(
            value =
                    """
            SELECT * FROM music_track
            WHERE youtube_video_id IS NOT NULL
              AND mood_tags IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 1
            """,
            nativeQuery = true)
    Optional<MusicTrack> findRandomWithMood();

    /** 무드 태그가 있는 모든 곡 (역방향 매칭용 — 팝업 → 곡) */
    @Query(
            "SELECT m FROM MusicTrack m WHERE m.youtubeVideoId IS NOT NULL AND m.moodTags IS NOT NULL AND m.moodTags <> ''")
    List<MusicTrack> findAllWithMood(Pageable pageable);

    /**
     * v2.14 — 캐시된 youtube_channel 제목이 cover/live/remix 변형을 시사하는 키워드를 포함하는 모든 트랙을 한 번에 가져온다. 어드민의
     * cover 캐시 일괄 청소 엔드포인트가 사용.
     *
     * <p>youtube_channel 은 channelTitle 이라 단순 검색이지만, 옛 데이터엔 cover 인지 분명히 알 수 있는 단어가 채널명/원본 매칭 단계에서
     * isOfficial=false 로 저장된 경우 함께 청소.
     */
    @Query(
            "SELECT m FROM MusicTrack m WHERE m.youtubeVideoId IS NOT NULL "
                    + "AND (LOWER(COALESCE(m.youtubeChannel, '')) LIKE '%cover%' "
                    + "  OR LOWER(COALESCE(m.youtubeChannel, '')) LIKE '%커버%' "
                    + "  OR LOWER(COALESCE(m.youtubeChannel, '')) LIKE '%remix%' "
                    + "  OR LOWER(COALESCE(m.youtubeChannel, '')) LIKE '%live%' "
                    + "  OR m.isOfficial = false)")
    List<MusicTrack> findLikelyNonOfficialCached();

    /** v2.14 — 어드민이 일괄 청소를 호출하면 youtube_video_id 만 비우고 다음 재생 시 재선택. */
    @Modifying
    @Transactional
    @Query(
            "UPDATE MusicTrack m SET m.youtubeVideoId = NULL, m.youtubeChannel = NULL, "
                    + "m.isOfficial = false WHERE m.id IN :ids")
    int clearYoutubeCacheByIds(java.util.Collection<Long> ids);

    /**
     * v2.21-S7 — 재생 실패 카운터 증가. 임계값 (기본 3) 초과 시 검색 후보에서 빠진다. 같은 트랙 한 번 실패 = 1 증가, race 무관하게 단일 SQL
     * UPDATE.
     */
    @Modifying
    @Transactional
    @Query(
            "UPDATE MusicTrack m SET m.playbackFailedCount = COALESCE(m.playbackFailedCount, 0) + 1 "
                    + "WHERE m.id = :id")
    int incrementPlaybackFailed(Long id);

    /** v2.21-S7 — 어드민 카드용: 임계값 이상 실패한 트랙 수 (embed 차단 통계). */
    @Query(
            "SELECT COUNT(m) FROM MusicTrack m "
                    + "WHERE COALESCE(m.playbackFailedCount, 0) >= :threshold")
    long countPlaybackBlocked(int threshold);
}
