package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * 음악 트랙 캐시. iTunes 메타데이터 + YouTube 재생 ID + Groq 가 분석한 분위기 태그.
 *
 * <p>캐시 TTL: 24시간 (YouTube TOS 준수). 24시간 지나면 last_searched_at 갱신 + 메타데이터 refresh.
 */
@Entity
@Table(name = "music_track")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MusicTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 레거시 — iTunes 시대의 트랙 ID. 새로 만드는 곡은 비어 있다 */
    @Column(name = "itunes_track_id", unique = true, length = 50)
    private String itunesTrackId;

    /** 현재 검색 소스인 Spotify 의 track ID */
    @Column(name = "spotify_track_id", unique = true, length = 50)
    private String spotifyTrackId;

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
    private String moodTags; // JSON 배열 문자열

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

    /**
     * 외부 API 재호출이 필요 없는 상태인지 판단한다.
     *
     * <p>정책: - YouTube 영상 ID 가 박혀 있으면 영구 캐시로 본다 (재호출 없음) - 아직 못 박은 곡만 다시 시도한다
     *
     * <p>24시간 TTL 을 들었다 풀었던 이력이 있는데, 한 번 매칭된 영상 ID 는 변경될 일이 거의 없고 매번 재호출하면 quota 가 빠르게 닳기 때문에 영구
     * 캐시로 변경. 메타데이터 갱신이 필요할 때는 별도 배치로 돌린다.
     */
    public boolean isCacheFresh() {
        return youtubeVideoId != null && !youtubeVideoId.isBlank();
    }
}
