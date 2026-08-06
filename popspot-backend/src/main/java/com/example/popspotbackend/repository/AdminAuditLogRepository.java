package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.AdminAuditLog;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 관리자 감사 로그 조회·정리. 쓰기는 {@code AdminAuditService} 만 한다. */
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    Page<AdminAuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<AdminAuditLog> findByActorIdOrderByCreatedAtDesc(String actorId, Pageable pageable);

    /** 실패만 — 권한 거부·오류. 사고 조사에서 가장 먼저 보는 화면이다. */
    Page<AdminAuditLog> findBySuccessFalseOrderByCreatedAtDesc(Pageable pageable);

    /**
     * 보관 기간이 지난 기록 삭제.
     *
     * <p>감사 로그를 무한히 쌓아 두면 그 자체가 위험이다 — 유출됐을 때 노출되는 범위가 계속 넓어진다. 사고 조사에 실제로 쓰이는 창은 몇 달이므로 그만큼만 남긴다.
     */
    @Modifying
    @Query("DELETE FROM AdminAuditLog a WHERE a.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);

    /*
     * ---------------------------------------------------------------------
     * D-1 보안 현황판이 쓰는 집계.
     *
     * 전부 JPQL 이다. 네이티브 SQL 로 쓰면 칼럼 이름을 손으로 맞춰야 하는데, 그건 컴파일도
     * 테스트도 통과하고 운영에서만 터진다 — 이 저장소의 topPopups 가 p.id 로 몇 주간 죽어
     * 있었다. JPQL 은 엔티티 필드 이름을 쓰므로 그 실수가 원천적으로 안 생긴다.
     * ---------------------------------------------------------------------
     */

    /** 기간 안의 전체 작업 수. */
    long countByCreatedAtGreaterThanEqual(LocalDateTime since);

    /** 그중 실패한 것. 갑자기 늘면 공격 시도이거나 무언가 고장난 것이다. */
    long countBySuccessFalseAndCreatedAtGreaterThanEqual(LocalDateTime since);

    /** 대상 종류별 건수 — 무엇을 주로 만졌나. */
    @Query(
            "SELECT a.targetType, COUNT(a) FROM AdminAuditLog a"
                    + " WHERE a.createdAt >= :since GROUP BY a.targetType ORDER BY COUNT(a) DESC")
    List<Object[]> countByTargetSince(@Param("since") LocalDateTime since);

    /**
     * 되돌릴 수 없는 작업 — 삭제.
     *
     * <p>{@code action} 은 "METHOD /패턴" 형태라 앞이 DELETE 인 것을 찾는다.
     */
    @Query(
            "SELECT a FROM AdminAuditLog a"
                    + " WHERE a.createdAt >= :since AND a.action LIKE 'DELETE %'"
                    + " ORDER BY a.createdAt DESC")
    List<AdminAuditLog> destructiveSince(@Param("since") LocalDateTime since, Pageable pageable);

    /**
     * 회원 개인정보를 만진 기록.
     *
     * <p>가장 민감한 축이다 — 방문자 내보내기·회원 목록이 여기 잡힌다. 개인정보 처리방침이
     * 약속한 접속기록 보관의 실질이기도 하다.
     */
    @Query(
            "SELECT a FROM AdminAuditLog a"
                    + " WHERE a.createdAt >= :since AND a.targetType = :targetType"
                    + " ORDER BY a.createdAt DESC")
    List<AdminAuditLog> byTargetSince(
            @Param("since") LocalDateTime since,
            @Param("targetType") String targetType,
            Pageable pageable);

    /**
     * 기간 안에 관리자 작업이 나온 IP 들.
     *
     * <p>두 기간을 각각 뽑아 비교하면 "이번에 처음 보는 IP" 를 알 수 있다. 관리자가 한 명인
     * 서비스에서 낯선 IP 는 그 자체로 확인할 이유가 된다.
     */
    @Query(
            "SELECT DISTINCT a.actorIp FROM AdminAuditLog a"
                    + " WHERE a.createdAt >= :since AND a.createdAt < :until AND a.actorIp IS NOT NULL")
    List<String> distinctIpsBetween(
            @Param("since") LocalDateTime since, @Param("until") LocalDateTime until);
}
