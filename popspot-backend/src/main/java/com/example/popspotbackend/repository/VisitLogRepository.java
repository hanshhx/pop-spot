package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.VisitLog;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VisitLogRepository extends JpaRepository<VisitLog, Long> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM VisitLog v WHERE v.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") LocalDateTime cutoff);

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

    /**
     * 방문자 목록 — visitorId 단위 집계. 방문수 · 다녀간 경로들 · 최근 방문 시각 · 순수게스트 여부(all_guest). all_guest=true 면 한
     * 번도 로그인 안 한 게스트, false 면 로그인 이력이 있는 회원. 최근 방문 순 100명.
     */
    @Query(
            value =
                    "SELECT visitor_id, COUNT(*) AS visits, STRING_AGG(DISTINCT path, ', ') AS paths, "
                            + "MAX(created_at) AS last_seen, BOOL_AND(guest) AS all_guest, "
                            + "MAX(user_agent) AS ua "
                            + "FROM visit_log WHERE created_at >= :since "
                            + "GROUP BY visitor_id ORDER BY MAX(created_at) DESC LIMIT 100",
            nativeQuery = true)
    List<Object[]> recentVisitors(@Param("since") LocalDateTime since);
}
