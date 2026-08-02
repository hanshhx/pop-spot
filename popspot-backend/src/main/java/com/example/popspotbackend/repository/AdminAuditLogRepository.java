package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.AdminAuditLog;
import java.time.LocalDateTime;
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
}
