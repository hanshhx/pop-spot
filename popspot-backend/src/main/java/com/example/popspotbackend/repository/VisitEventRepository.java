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
     * <p>{@code session_id} 가 비어 있는 행은 세션 계산에서 빼되(옛 기록·비콘 실패), 방문자와 행동 수에는 그대로 넣는다. 여기서 통째로 걸러내면
     * 세션만 없는 방문이 <b>없었던 방문</b>이 돼 방문자 수가 다른 표와 어긋난다.
     *
     * <p>돌아오는 값 순서: 세션수, 방문자수, 행동수.
     *
     * <p><b>별칭 {@code e.} 를 반드시 붙인다.</b> 컬럼명 검사 테스트({@code NativeQueryColumnsTest})가 {@code 별칭.컬럼}
     * 형태만 훑기 때문에, 별칭 없이 쓰면 오타가 있어도 검사에 걸리지 않는다. 실제로 실험해 보니 {@code session_id} 를 {@code sessionid} 로
     * 바꿔도 테스트가 통과했다. 네이티브 쿼리 오타는 컴파일도 테스트도 통과하고 <b>운영에서만 터진다</b> — 이 저장소의 {@code topPopups} 가
     * {@code p.id} 로 몇 주간 죽어 있었던 것이 같은 이유였다.
     */
    @Query(
            value =
                    "SELECT COUNT(DISTINCT e.session_id), COUNT(DISTINCT e.visitor_id), COUNT(*)"
                            + " FROM visit_event e"
                            + " WHERE e.created_at >= :since AND e.created_at < :until",
            nativeQuery = true)
    Object[] sessionTotals(
            @Param("since") LocalDateTime since, @Param("until") LocalDateTime until);

    /**
     * 기간 안에 온 사람 중 <b>그 전에도 왔던</b> 사람 수 = 재방문자.
     *
     * <p>나머지는 신규다. 신규를 따로 세지 않고 빼는 이유는, 두 쿼리의 기준이 달라지면 합이 전체와 안 맞는 일이 실제로 생기기 때문이다.
     *
     * <p><b>한계를 알고 써야 한다.</b> "그 전" 은 보관기간(방침상 90일) 안에서만 볼 수 있다. 91일 전에 왔던 사람은 기록이 지워져 신규로 잡힌다. 즉 이
     * 값은 <b>재방문율의 하한</b>이다 — 실제보다 낮게 나올 수는 있어도 높게 나오지는 않는다.
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

    /**
     * C-4 퍼널 — 행동 종류별로 <b>몇 사람이</b> 그 단계를 밟았나.
     *
     * <p><b>사람 수를 센다. 횟수가 아니다.</b> 퍼널은 "100명 중 몇 명이 다음으로 갔나" 를 묻는 것이라, 한 사람이 팝업 스무 개를 연 것과 스무 명이
     * 하나씩 연 것이 같아 보이면 안 된다.
     *
     * <p>단계 순서·이름은 여기서 정하지 않는다. 종류별 사람 수만 돌려주고, 어떤 순서로 세울지는 {@code VisitService} 가 정한다 — 순서가 SQL 에
     * 박히면 단계를 바꿀 때마다 쿼리를 고쳐야 한다.
     *
     * <p><b>가장 이른 기록 시각을 함께 준다.</b> 행동 종류는 나중에 늘어날 수 있고(실제로 {@code wishlist_add} · {@code
     * outbound_click} 이 C-4 에서 추가됐다), 그 종류는 배포 전 기간에 대해 0 이다. 그 사실을 모르면 <b>퍼널이 그 칸에서 뚝 끊긴 것처럼</b>
     * 보인다. 설정으로 날짜를 적어 두는 방법도 있지만 그러면 배포 때마다 사람이 손대야 하고 잊으면 또 틀린다 — 데이터에 물어보면 저절로 맞는다.
     *
     * <p>돌아오는 값: {@code (event_type, 사람 수, 가장 이른 기록 시각)}.
     */
    @Query(
            value =
                    "SELECT e.event_type, COUNT(DISTINCT e.visitor_id), MIN(e.created_at)"
                            + " FROM visit_event e"
                            + " WHERE e.created_at >= :since"
                            + " GROUP BY e.event_type",
            nativeQuery = true)
    List<Object[]> visitorsByType(@Param("since") LocalDateTime since);

    /**
     * 이 종류가 <b>언제부터</b> 기록됐나 — 기간과 무관하게 전체에서 가장 이른 시각.
     *
     * <p>위 {@code visitorsByType} 의 최소값은 조회 구간 안에서만 본 것이라, 구간보다 앞서 수집이 시작됐으면 "구간 시작일" 이 나온다. 그러면
     * 처음부터 모아 온 단계까지 "최근에 시작됨" 으로 보인다. 수집 시작일은 구간과 상관없는 사실이므로 따로 묻는다.
     */
    @Query(
            value = "SELECT MIN(e.created_at) FROM visit_event e WHERE e.event_type = :eventType",
            nativeQuery = true)
    LocalDateTime firstRecordedAt(@Param("eventType") String eventType);

    /**
     * 기간 안에 상세를 <b>연 적이 있는</b> 사람 중, 그 뒤로 <b>다른 세션에서</b> 또 온 사람 수.
     *
     * <p>퍼널의 마지막 칸(재방문)이다. 같은 세션 안의 여러 행동은 재방문이 아니므로 세션이 달라야 한다 — 이 조건을 빼면 한 번 왔다 간 사람이 전부 재방문으로 잡혀
     * 퍼널 끝이 부풀려진다.
     *
     * <p>{@code session_id} 가 없는 옛 기록은 세션을 비교할 수 없어 빠진다. 그만큼 <b>낮게</b> 나오지 높게 나오지는 않는다.
     */
    @Query(
            value =
                    "SELECT COUNT(DISTINCT a.visitor_id)"
                            + " FROM visit_event a"
                            + " JOIN visit_event b ON b.visitor_id = a.visitor_id"
                            + " AND b.session_id IS DISTINCT FROM a.session_id"
                            + " AND b.created_at > a.created_at"
                            + " WHERE a.created_at >= :since"
                            + " AND a.event_type = :openType"
                            + " AND a.session_id IS NOT NULL",
            nativeQuery = true)
    long countReturnedAfterOpen(
            @Param("since") LocalDateTime since, @Param("openType") String openType);

    /** 개인정보 처리방침의 90일 보관 약속을 코드로 강제한다. {@code VisitService} 의 정리 작업이 함께 부른다. */
    @Modifying
    @Query("DELETE FROM VisitEvent e WHERE e.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
