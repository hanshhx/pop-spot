package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 음악 트랙 캐시.
 * iTunes 메타데이터 + YouTube 재생 ID + Groq 가 분석한 분위기 태그.
 *
 * 캐시 TTL: 24시간 (YouTube TOS 준수).
 * 24시간 지나면 last_searched_at 갱신 + 메타데이터 refresh.
 */
@Entity
@Table(name = "music_track")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MusicTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "itunes_track_id", unique = true, nullable = false, length = 50)
    private String itunesTrackId;

    @Column(name = "artist_name", nullable = false, length = 200)
    private String artistName;

    @Column(name = "track_name", nullable = false, length = 300)
    private String trackName;

    @Column(name = "album_name", length = 300)
    private String albumName;

    @Column(name = "artwork_url", columnDefinition = "TEXT")
    private String artworkUrl;

    @Column(name = "artwork_url_hires", columnDefinition = "TEXT")
    private String artworkUrlHires;

    @Column(name = "preview_url", columnDefinition = "TEXT")
    private String previewUrl;

    @Column(name = "youtube_video_id", length = 20)
    private String youtubeVideoId;

    @Column(name = "youtube_channel", length = 200)
    private String youtubeChannel;

    @Column(name = "is_official")
    private Boolean isOfficial;

    @Column(name = "mood_tags", columnDefinition = "TEXT")
    private String moodTags;        // JSON 배열 문자열

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "play_count")
    private Integer playCount;

    @Column(name = "last_searched_at")
    private LocalDateTime lastSearchedAt;

    @Column(name = "cached_at")
    private LocalDateTime cachedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (cachedAt == null) cachedAt = LocalDateTime.now();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (playCount == null) playCount = 0;
        if (isOfficial == null) isOfficial = false;
    }

    /** 캐시가 24시간 이내면 fresh — YouTube TOS 준수 */
    public boolean isCacheFresh() {
        if (cachedAt == null) return false;
        return cachedAt.isAfter(LocalDateTime.now().minusHours(24));
    }
}
