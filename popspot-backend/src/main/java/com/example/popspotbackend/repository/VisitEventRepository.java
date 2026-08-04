package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.VisitEvent;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 방문 행동 기록 — 쓰기는 비콘, 읽기는 관리자 통계. */
public interface VisitEventRepository extends JpaRepository<VisitEvent, Long> {

    /**
     * 많이 열린 팝업 — 이 표를 만든 첫 번째 이유.
     *
     * <p>누른 <b>횟수</b>와 누른 <b>사람 수</b>를 함께 센다. 한 사람이 스무 번 들락거린 팝업과 스무 명이 한 번씩 본 팝업은 전혀 다른 이야기인데, 횟수만
     * 세면 둘이 같아 보인다.
     */
    @Query(
            value =
                    "SELECT e.popup_id, MIN(p.name) AS name, COUNT(*) AS opens,"
                            + " COUNT(DISTINCT e.visitor_id) AS visitors"
                            + " FROM visit_event e"
                            // LEFT JOIN 이다. 팝업이 지워져도 그 클릭 기록은 남아야 한다 —
                            // INNER 로 두면 삭제된 팝업의 인기가 통계에서 조용히 사라져,
                            // "왜 합계가 안 맞지" 가 된다.
                            //
                            // popup_store 의 기본키 칼럼은 popup_id 다. id 가 아니다
                            // (PopupStore 엔티티의 필드 이름은 id 지만 @Column(name="popup_id")).
                            // p.id 로 적었다가 이 조회가 통째로 죽었다 — 네이티브 쿼리라
                            // 컴파일도 통과하고 테스트도 통과하고, 운영에서만 터진다.
                            + " LEFT JOIN popup_store p ON p.popup_id = e.popup_id"
                            + " WHERE e.created_at >= :since AND e.event_type = :eventType"
                            + " AND e.popup_id IS NOT NULL"
                            + " GROUP BY e.popup_id ORDER BY opens DESC LIMIT :limit",
            nativeQuery = true)
    List<Object[]> topPopups(
            @Param("since") LocalDateTime since,
            @Param("eventType") String eventType,
            @Param("limit") int limit);

    /** 행동 종류별 발생 횟수 — 무엇이 실제로 쓰이는지. */
    @Query(
            value =
                    "SELECT event_type, COUNT(*) AS total FROM visit_event"
                            + " WHERE created_at >= :since"
                            + " GROUP BY event_type ORDER BY total DESC",
            nativeQuery = true)
    List<Object[]> countByType(@Param("since") LocalDateTime since);

    /** 개인정보 처리방침의 90일 보관 약속을 코드로 강제한다. {@code VisitService} 의 정리 작업이 함께 부른다. */
    @Modifying
    @Query("DELETE FROM VisitEvent e WHERE e.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
