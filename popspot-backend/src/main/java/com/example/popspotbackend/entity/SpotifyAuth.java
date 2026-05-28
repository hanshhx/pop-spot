package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * v2.21-S10 — Spotify OAuth 토큰 저장.
 *
 * <p>각 popspot 사용자가 자기 Spotify 계정을 연결하면 1 row 가 생긴다. Web Playback SDK 가 streaming 권한을 받으려면
 * access_token 이 필요하고, 1시간 만료라 refresh_token 으로 자동 갱신해야 한다.
 *
 * <p>토큰은 평문 저장 금지 (Spotify Developer Policy + PIPA). AES-256 GCM 으로 암호화된 Base64 문자열을 그대로 보관.
 * 회원 탈퇴 시 FK ON DELETE CASCADE 로 자동 삭제.
 */
@Entity
@Table(name = "spotify_auth")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpotifyAuth {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true, length = 255)
    private String userId;

    @Column(name = "spotify_user_id", nullable = false, length = 255)
    private String spotifyUserId;

    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    @Column(name = "refresh_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "is_premium", nullable = false)
    private Boolean isPremium;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (isPremium == null) isPremium = false;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
