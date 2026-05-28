package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.SpotifyAuth;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

public interface SpotifyAuthRepository extends JpaRepository<SpotifyAuth, Long> {

    Optional<SpotifyAuth> findByUserId(String userId);

    /** v2.21-S14 — 회원 탈퇴 시 호출 (PIPA + Spotify 약관 즉시 삭제 의무). */
    @Modifying
    @Transactional
    void deleteByUserId(String userId);
}
