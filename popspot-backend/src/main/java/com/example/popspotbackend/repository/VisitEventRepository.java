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

    /**
     * 기간 안의 세션 규모 — 세션 수 · 방문자 수 · 행동 수를 한 번에 센다.
     *
     * <p>{@code session_id} 가 비어 있는 행은 세션 계산에서 빼되(옛 기록·비콘 실패), 방문자와 행동
     * 수에는 그대로 넣는다. 여기서 통째로 걸러내면 세션만 없는 방문이 <b>없었던 방문</b>이 돼
     * 방문자 수가 다른 표와 어긋난다.
     *
     * <p>돌아오는 값 순서: 세션수, 방문자수, 행동수.
     *
     * <p><b>별칭 {@code e.} 를 반드시 붙인다.</b> 컬럼명 검사 테스트({@code NativeQueryColumnsTest})가
     * {@code 별칭.컬럼} 형태만 훑기 때문에, 별칭 없이 쓰면 오타가 있어도 검사에 걸리지 않는다.
     * 실제로 실험해 보니 {@code session_id} 를 {@code sessionid} 로 바꿔도 테스트가 통과했다.
     * 네이티브 쿼리 오타는 컴파일도 테스트도 통과하고 <b>운영에서만 터진다</b> — 이 저장소의
     * {@code topPopups} 가 {@code p.id} 로 몇 주간 죽어 있었던 것이 같은 이유였다.
     */
    @Query(
            value =
                    "SELECT COUNT(DISTINCT e.session_id), COUNT(DISTINCT e.visitor_id), COUNT(*)"
                            + " FROM visit_event e"
                            + " WHERE e.created_at >= :since AND e.created_at < :until",
            nativeQuery = true)
    Object[] sessionTotals(@Param("since") LocalDateTime since, @Param("until") LocalDateTime until);

    /**
     * 기간 안에 온 사람 중 <b>그 전에도 왔던</b> 사람 수 = 재방문자.
     *
     * <p>나머지는 신규다. 신규를 따로 세지 않고 빼는 이유는, 두 쿼리의 기준이 달라지면 합이 전체와
     * 안 맞는 일이 실제로 생기기 때문이다.
     *
     * <p><b>한계를 알고 써야 한다.</b> "그 전" 은 보관기간(방침상 90일) 안에서만 볼 수 있다. 91일 전에
     * 왔던 사람은 기록이 지워져 신규로 잡힌다. 즉 이 값은 <b>재방문율의 하한</b>이다 — 실제보다 낮게
     * 나올 수는 있어도 높게 나오지는 않는다.
     */
    @Query(
            value =
                    "SELECT COUNT(*) FROM ("
                            + "  SELECT n.visitor_id FROM visit_event n"
                            + "  WHERE n.created_at >= :since AND n.created_at < :until"
                            + "  INTERSECT"
                            + "  SELECT o.visitor_id FROM visit_event o WHERE o.created_at < :since"
                            + ") AS returning_visitors",
            nativeQuery = true)
    long countReturningVisitors(
            @Param("since") LocalDateTime since, @Param("until") LocalDateTime until);

    /** 개인정보 처리방침의 90일 보관 약속을 코드로 강제한다. {@code VisitService} 의 정리 작업이 함께 부른다. */
    @Modifying
    @Query("DELETE FROM VisitEvent e WHERE e.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
