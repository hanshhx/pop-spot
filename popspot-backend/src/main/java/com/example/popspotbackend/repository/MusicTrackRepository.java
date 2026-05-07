package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MusicTrack;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MusicTrackRepository extends JpaRepository<MusicTrack, Long> {

    Optional<MusicTrack> findByItunesTrackId(String itunesTrackId);

    /** 가장 많이 재생된 N 곡 (인기 차트) */
    @Query("SELECT m FROM MusicTrack m WHERE m.youtubeVideoId IS NOT NULL ORDER BY m.playCount DESC")
    List<MusicTrack> findTopPlayed(Pageable pageable);

    /** 무드 태그가 있는 곡 중 랜덤 1곡 (운명의 곡 룰렛) */
    @Query(value = """
            SELECT * FROM music_track
            WHERE youtube_video_id IS NOT NULL
              AND mood_tags IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 1
            """, nativeQuery = true)
    Optional<MusicTrack> findRandomWithMood();

    /** 무드 태그가 있는 모든 곡 (역방향 매칭용 — 팝업 → 곡) */
    @Query("SELECT m FROM MusicTrack m WHERE m.youtubeVideoId IS NOT NULL AND m.moodTags IS NOT NULL AND m.moodTags <> ''")
    List<MusicTrack> findAllWithMood(Pageable pageable);
}
