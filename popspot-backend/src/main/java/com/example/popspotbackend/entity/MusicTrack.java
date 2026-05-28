package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 음악 트랙 캐시. Spotify 메타데이터 + YouTube 재생 ID + Groq 가 분석한 분위기 태그.
 *
 * <p>한 번 YouTube 영상 ID 가 박힌 행은 영구 캐시로 간주한다. 매번 외부 API 를 재호출하면 quota(YouTube 10,000/day) 가 빠르게 닳기
 * 때문. 메타데이터 갱신이 필요할 때만 별도 배치로 처리.
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

    /** 레거시 — iTunes 시대의 트랙 ID. 새로 만드는 곡은 비어 있다. */
    @Column(name = "itunes_track_id", unique = true, length = 50)
    private String itunesTrackId;

    /** 현재 검색 소스인 Spotify 의 track ID. */
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

    /** Groq 가 분석한 무드 태그 JSON 배열 (40개 화이트리스트 중 최대 5개). */
    @Column(name = "mood_tags", columnDefinition = "TEXT")
    private String moodTags;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "play_count")
    private Integer playCount;

    /**
     * v2.21-S7 — YouTube IFrame 재생 실패 누적 횟수. 클라이언트가 onError (101/150 embed 차단, 100 비공개/삭제 등) 받을 때마다
     * 1 증가. 임계값 초과 시 검색 후보에서 자동 제외해 사용자가 같은 막힌 곡을 또 만나는 회귀를 차단한다.
     */
    @Column(name = "playback_failed_count", columnDefinition = "integer default 0")
    private Integer playbackFailedCount;

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
     * <p>YouTube 영상 ID 가 박혀 있으면 영구 캐시로 본다. 한 번 매칭된 영상 ID 는 바뀔 일이 거의 없고 매번 재호출하면 quota 가 빠르게 닳기 때문.
     */
    public boolean isCacheFresh() {
        return youtubeVideoId != null && !youtubeVideoId.isBlank();
    }
}
