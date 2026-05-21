package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Feedback;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    /** 본인 의견 목록 (최신순). */
    List<Feedback> findAllByUserIdOrderByCreatedAtDesc(String userId);

    /** 어드민 검수 큐 — 상태 필터 + 페이징 + 최신순. */
    @Query(
            "SELECT f FROM Feedback f "
                    + "WHERE (:status IS NULL OR f.status = :status) "
                    + "ORDER BY f.createdAt DESC")
    List<Feedback> findForAdmin(@Param("status") String status, Pageable pageable);

    /** 상태별 카운트 — 어드민 대시보드 메트릭 카드용. */
    long countByStatus(String status);
}
