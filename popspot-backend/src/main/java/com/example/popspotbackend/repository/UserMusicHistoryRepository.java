package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.UserMusicHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserMusicHistoryRepository extends JpaRepository<UserMusicHistory, Long> {

    /** 사용자의 최근 청취 기록 (최신순) */
    List<UserMusicHistory> findByUserIdOrderByPlayedAtDesc(String userId, Pageable pageable);

    /** 사용자가 같은 곡 중복 등록 방지용 카운트 */
    long countByUserIdAndTrackId(String userId, Long trackId);
}
