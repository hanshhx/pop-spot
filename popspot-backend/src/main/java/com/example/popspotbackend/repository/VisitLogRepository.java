package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.VisitLog;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VisitLogRepository extends JpaRepository<VisitLog, Long> {

    @Query(
            value = "SELECT COUNT(DISTINCT visitor_id) FROM visit_log WHERE created_at >= :since",
            nativeQuery = true)
    long countDistinctVisitorsSince(@Param("since") LocalDateTime since);

    @Query(value = "SELECT COUNT(*) FROM visit_log WHERE created_at >= :since", nativeQuery = true)
    long countPageviewsSince(@Param("since") LocalDateTime since);

    @Query(
            value =
                    "SELECT COUNT(DISTINCT visitor_id) FROM visit_log WHERE created_at >= :since AND guest = :guest",
            nativeQuery = true)
    long countDistinctVisitorsByGuestSince(
            @Param("since") LocalDateTime since, @Param("guest") boolean guest);

    @Query(
            value =
                    "SELECT to_char(created_at, 'MM-DD') AS d, COUNT(DISTINCT visitor_id) AS v FROM visit_log WHERE created_at >= :since GROUP BY d ORDER BY d",
            nativeQuery = true)
    List<Object[]> dailyVisitorsSince(@Param("since") LocalDateTime since);

    @Query(
            value =
                    "SELECT path, COUNT(*) AS c FROM visit_log WHERE created_at >= :since AND path IS NOT NULL GROUP BY path ORDER BY c DESC LIMIT 8",
            nativeQuery = true)
    List<Object[]> topPathsSince(@Param("since") LocalDateTime since);

    /** 경로별 총 페이지뷰 + 회원(비게스트) 뷰 — 오늘 방문이 어디서/누구(회원 vs 게스트·봇)인지 진단용. */
    @Query(
            value =
                    "SELECT path, COUNT(*) AS total, SUM(CASE WHEN guest THEN 0 ELSE 1 END) AS members "
                            + "FROM visit_log WHERE created_at >= :since AND path IS NOT NULL "
                            + "GROUP BY path ORDER BY total DESC LIMIT 50",
            nativeQuery = true)
    List<Object[]> pathBreakdownSince(@Param("since") LocalDateTime since);
}
