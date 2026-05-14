package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/** 사용자별 음악 청취 기록 (음악 패스포트용). */
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
