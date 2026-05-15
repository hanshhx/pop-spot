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
 * 사용자별 음악 청취 기록 (음악 패스포트 화면 + 추천 큐 보충에 사용).
 *
 * <p>{@code matchedPopupId} 는 그 곡 재생 시 함께 추천된 팝업 ID (있으면) — 패스포트에서 "이 곡을 들었던 그날 본 팝업" 형태로 표시.
 */
@Entity
@Table(name = "user_music_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserMusicHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "track_id", nullable = false)
    private Long trackId;

    @Column(name = "played_at")
    private LocalDateTime playedAt;

    @Column(name = "matched_popup_id")
    private Long matchedPopupId;

    @PrePersist
    void prePersist() {
        if (playedAt == null) playedAt = LocalDateTime.now();
    }
}
