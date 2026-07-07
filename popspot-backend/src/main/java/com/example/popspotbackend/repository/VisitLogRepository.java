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
}
