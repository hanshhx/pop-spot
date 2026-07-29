package com.example.popspotbackend.repository;

// 🔥 [임의 수정] 한 번의 쿼리로 연관된 데이터를 가져오기 위한 어노테이션 추가
import com.example.popspotbackend.entity.PopupStore;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// ✅ ID 타입을 String -> Long으로 변경하여 에러 해결
public interface PopupStoreRepository extends JpaRepository<PopupStore, Long> {

    // 1. 카테고리 필터링을 위한 메서드 (기존 코드 유지)
    // 🔥 [임의 수정] LAZY로 인해 발생하는 N+1 쿼리 에러를 방지하기 위해 images를 JOIN FETCH 합니다.
    @EntityGraph(attributePaths = {"images"})
    List<PopupStore> findByCategory(String category);

    // 2. 조회수 높은 순서대로 상위 4개만 가져오는 메서드 (기존 코드 유지)
    // 🔥 [임의 수정]
    @EntityGraph(attributePaths = {"images"})
    List<PopupStore> findTop4ByOrderByViewCountDesc();

    // 3. 검색 기능 (기존 코드 유지)
    // 🔥 [임의 수정]
    @EntityGraph(attributePaths = {"images"})
    List<PopupStore> findByNameContainingOrLocationContaining(String name, String location);

    // 🔥 [임의 수정]
    @EntityGraph(attributePaths = {"images"})
    List<PopupStore> findByStatus(String status);

    /**
     * 같은 좌표(위경도 문자열 정확 일치)에 이미 저장된 팝업 수. 주소가 모호한 팝업을 카카오가 지역 중심점 하나로 찍어 수백 개가 겹치는(지도에 링처럼 보이는) 문제를,
     * 수집 시점에 그 좌표로의 추가 저장을 막아 방지하기 위해 사용한다.
     */
    long countByLatitudeAndLongitude(String latitude, String longitude);

    // 🔥 [임의 수정] findAll을 호출할 때도 이미지가 필요하므로 오버라이드하여 EntityGraph를 적용합니다.
    @Override
    @EntityGraph(attributePaths = {"images"})
    List<PopupStore> findAll();

    // 🔥 [24번 임의 수정] 관리자 대시보드에서 영업중/대기중인 팝업 '개수'만 필요할 때 사용할 메서드입니다.
    int countByStatus(String status);

    /**
     * 인기 팝업 — DB 단에서 PENDING 제외 + viewCount 정렬 + LIMIT. 메모리에 전체 row 를 끌어와서 sort/filter 하던 기존 로직을
     * 대체.
     */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            "SELECT p FROM PopupStore p WHERE (p.status IS NULL OR p.status <> 'PENDING') ORDER BY"
                    + " COALESCE(p.viewCount, 0) DESC")
    List<PopupStore> findTrending(Pageable pageable);

    /** 비-PENDING 전체 (페이징/정렬은 호출자에서 결정) */
    @EntityGraph(attributePaths = {"images"})
    @Query("SELECT p FROM PopupStore p WHERE p.status IS NULL OR p.status <> 'PENDING'")
    List<PopupStore> findAllVisible();

    // ============================================================
    // [V4] 자동수집 / 캘린더 / 만료 / 검수 / Takedown 쿼리
    // ============================================================

    /** 중복 수집 방어 (external_id = SHA-256(name + location + startDate)) */
    Optional<PopupStore> findByExternalId(String externalId);

    /**
     * "오늘" 의 KST 날짜 문자열(YYYY-MM-DD).
     *
     * <p>{@code LocalDate.now()} 는 JVM 기본 시간대를 따르는데 운영 서버는 UTC 라 KST 새벽 시간대에 하루가 어긋난다. 팝업의 시작·종료일은
     * 한국 기준이므로 존을 명시한다.
     */
    static String todayKst() {
        return LocalDate.now(SEOUL).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /**
     * "보여줄 수 있는" 팝업의 통일 필터. - status NOT IN ('PENDING','EXPIRED') - review_status 가 NULL(레거시
     * manual) / AUTO_PUBLISHED / APPROVED 만 노출 - PENDING_REVIEW / REJECTED / TAKEDOWN 은 차단
     *
     * <p>{@code status} 뿐 아니라 실제 {@code endDate} 도 본다. status=EXPIRED 전환은 하루 1회 스케줄러가 하므로, 그것이
     * 지연·실패하면 이미 끝난 팝업이 계속 공개된다. 날짜로 한 겹 더 막아 스케줄러가 멈춰도 사용자에게는 보이지 않게 한다. 종료일이 없는 건은 남긴다 — 날짜 미상일 뿐
     * 종료 근거가 아니므로 추측해서 숨기지 않는다(프론트와 동일 정책).
     */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE (p.status IS NULL OR p.status NOT IN ('PENDING','EXPIRED'))
              AND (p.reviewStatus IS NULL OR p.reviewStatus IN ('AUTO_PUBLISHED','APPROVED'))
              AND (p.endDate IS NULL OR p.endDate = '' OR p.endDate >= :today)
           """)
    List<PopupStore> findAllPublicAsOf(@Param("today") String today);

    /** {@link #findAllPublicAsOf} 를 KST 오늘 기준으로 호출. 호출부가 날짜를 신경 쓰지 않게 한다. */
    default List<PopupStore> findAllPublic() {
        return findAllPublicAsOf(todayKst());
    }

    /**
     * 캘린더 — 지정된 날짜 구간에 행사 기간이 걸친 팝업. 포함 조건: startDate <= toDate AND endDate >= fromDate
     * startDate/endDate 는 String(YYYY-MM-DD) 이지만 ISO 형태이므로 사전식 비교 안전.
     */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE (p.status IS NULL OR p.status NOT IN ('PENDING','EXPIRED'))
              AND (p.reviewStatus IS NULL OR p.reviewStatus IN ('AUTO_PUBLISHED','APPROVED'))
              AND p.startDate IS NOT NULL AND p.endDate IS NOT NULL
              AND p.startDate <= :toDate
              AND p.endDate   >= :fromDate
            ORDER BY p.startDate ASC
           """)
    List<PopupStore> findCalendarRange(
            @Param("fromDate") String fromDate, @Param("toDate") String toDate);

    /**
     * 인기 팝업 — public 한 것만 (자동게시 + 수동 둘 다 포함, 만료 제외).
     *
     * <p>이 경로는 {@code PopupStoreService.isPublic} 필터를 거치지 않고 결과를 그대로 반환하므로, 만료 차단이 쿼리에 없으면 인기 목록에만
     * 종료된 팝업이 남는다.
     */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE (p.status IS NULL OR p.status NOT IN ('PENDING','EXPIRED'))
              AND (p.reviewStatus IS NULL OR p.reviewStatus IN ('AUTO_PUBLISHED','APPROVED'))
              AND (p.endDate IS NULL OR p.endDate = '' OR p.endDate >= :today)
            ORDER BY COALESCE(p.viewCount, 0) DESC
           """)
    List<PopupStore> findTrendingPublicAsOf(@Param("today") String today, Pageable pageable);

    /** {@link #findTrendingPublicAsOf} 를 KST 오늘 기준으로 호출. */
    default List<PopupStore> findTrendingPublic(Pageable pageable) {
        return findTrendingPublicAsOf(todayKst(), pageable);
    }

    /** admin 검수 큐 (신뢰도 낮음) */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            "SELECT p FROM PopupStore p WHERE p.reviewStatus = 'PENDING_REVIEW' ORDER BY"
                    + " p.crawledAt DESC")
    List<PopupStore> findPendingReview(Pageable pageable);

    /** 만료 처리 대상 (오늘보다 endDate 가 작은 row) — 1회 실행 후 status=EXPIRED 로 update */
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE p.endDate IS NOT NULL
              AND p.endDate < :today
              AND (p.status IS NULL OR p.status <> 'EXPIRED')
           """)
    List<PopupStore> findToExpire(@Param("today") String today);

    @Modifying
    @Query("UPDATE PopupStore p SET p.status = 'EXPIRED' WHERE p.id IN :ids")
    int markExpired(@Param("ids") List<Long> ids);

    /** 자동수집됐지만 좌표가 비어있는 row — geocoding backfill 대상 */
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE p.sourceType = 'CRAWLED'
              AND (p.latitude IS NULL OR p.latitude = ''
                   OR p.longitude IS NULL OR p.longitude = '')
           """)
    List<PopupStore> findCrawledMissingCoordinates();

    /**
     * 시작일이 비어있는 자동수집 row 중 이름·위치가 일치하는 것 — 날짜 점진 보강용.
     *
     * <p>왜 external_id 가 아니라 이름·위치인가: null-date row 의 external_id 는 {@code hash(name|location|"")}
     * 인데, 재크롤이 유효 startDate 를 뽑으면 external_id 가 {@code hash(name|location|날짜)} 로 바뀌어 {@link
     * #findByExternalId} 를 빗나간다(= 지금까지 중복 row 를 만들던 원인). 이름 기준으로 원본 row 를 되찾아 null 인 날짜만 채워
     * in-place 로 갱신한다. 정규화(trim + lower)는 크롤러의 external_id 계산·dedup 정책과 맞춘다. external_id 가 unique 라
     * 매칭은 사실상 1건이지만 방어적으로 List.
     */
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE p.sourceType = 'CRAWLED'
              AND LOWER(TRIM(p.name)) = :name
              AND LOWER(TRIM(p.location)) = :location
              AND (p.startDate IS NULL OR p.startDate = '')
           """)
    List<PopupStore> findCrawledMissingStartDate(
            @Param("name") String name, @Param("location") String location);

    /** 날짜가 하나라도 비어 있고 원본 URL이 남아 있는 자동수집 팝업. 기존 데이터 재정규화 대상을 제한된 배치로 고르는 용도다. */
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE p.sourceType = 'CRAWLED'
              AND p.sourceUrl IS NOT NULL AND p.sourceUrl <> ''
              AND (p.startDate IS NULL OR p.startDate = ''
                   OR p.endDate IS NULL OR p.endDate = '')
            ORDER BY p.lastSeenAt ASC, p.id ASC
           """)
    List<PopupStore> findCrawledMissingDates();

    /**
     * 본문 날짜 보강({@code PopupDateBackfillService})이 이번 회차에 훑을 대상.
     *
     * <p>v2.46.1 — {@link #findCrawledMissingDates()} 를 그대로 쓰다가 두 가지 문제를 확인했다.
     *
     * <ul>
     *   <li><b>같은 대상을 매번 다시 훑는다.</b> {@code lastSeenAt} 오름차순이라 기간을 못 찾은 팝업이 다음 회차에도 맨 앞에 그대로 남는다.
     *       실측에서 80건 중 65건이 매번 실패했고, 그 65건이 입구를 막아 나머지 800여 건에는 <b>영영 도달하지 못한다.</b>
     *   <li><b>가장 값어치 낮은 순서다.</b> v2.45 부터 새 팝업은 날짜가 있어야 저장되므로, 결손 목록에 남은 것은 대부분 옛날에 끝난 팝업이다. 채워도
     *       "이미 종료" 로 사라진다.
     * </ul>
     *
     * <p>그래서 <b>가치로 나눈 뒤 그 안에서 무작위</b>로 뽑는다.
     *
     * <ul>
     *   <li>0순위 — 시작일은 있고 <b>종료일만 빈</b> 팝업. 지금 화면에 보이고 있어(v2.44 isOpenNow 통과) 종료일이 채워지면 "언제 끝나는지" 를
     *       바로 답할 수 있다. 실측 883건 중 323건.
     *   <li>1순위 — 나머지(둘 다 없음 등).
     * </ul>
     *
     * <p>무작위가 필요한 이유는 순환이다. 우선순위만 두면 그 안에서 또 같은 것만 보고, 무작위만 쓰면 값어치 낮은 옛 팝업에 예산을 쓴다. 둘을 겹쳐야 매 회차 다른
     * 대상을 보면서도 값어치 순서를 지킨다.
     *
     * <p>기존 메서드를 고치지 않고 새로 만든 것은 그쪽을 LLM 재처리 큐({@code queueMissingDateSources})가 함께 쓰기 때문이다 — 정렬을
     * 바꾸면 그 동작까지 조용히 달라진다.
     */
    @Query(
            value =
                    """
                   SELECT * FROM popup_store p
                    WHERE p.source_type = 'CRAWLED'
                      AND p.source_url IS NOT NULL AND p.source_url <> ''
                      AND (p.start_date IS NULL OR p.start_date = ''
                           OR p.end_date IS NULL OR p.end_date = '')
                    ORDER BY
                      CASE WHEN p.start_date IS NOT NULL AND p.start_date <> ''
                                AND (p.end_date IS NULL OR p.end_date = '')
                           THEN 0 ELSE 1 END,
                      RANDOM()
                    LIMIT :limit
                   """,
            nativeQuery = true)
    List<PopupStore> findDateBackfillTargets(@Param("limit") int limit);

    /**
     * 표시용 번역 대상 — 아직 번역을 <b>시도하지 않은</b> 팝업.
     *
     * <p>{@code translated_at IS NULL} 하나로 거른다. 번역 칸이 비어 있는지로 고르면, 확신이 없어 일부러
     * 비워 둔 행을 매번 다시 시도하게 된다("한복상점" 처럼 원문이 나은 것이 실제로 있다).
     *
     * <p>이미 끝난 팝업은 뺀다. 화면에 안 나오는 것을 번역하는 데 LLM 예산을 쓸 이유가 없다.
     * 시작일이 가까운 것부터 — 지금 열려 있거나 곧 열릴 팝업이 외국인에게 먼저 보인다.
     */
    @Query(
            value =
                    """
                   SELECT * FROM popup_store p
                    WHERE p.translated_at IS NULL
                      AND p.name IS NOT NULL AND p.name <> ''
                      AND (p.end_date IS NULL OR p.end_date = '' OR p.end_date >= :today)
                    ORDER BY
                      CASE WHEN p.start_date IS NULL OR p.start_date = '' THEN 1 ELSE 0 END,
                      p.start_date DESC
                    LIMIT :limit
                   """,
            nativeQuery = true)
    List<PopupStore> findTranslationTargets(@Param("today") String today, @Param("limit") int limit);

    /** 번역 진행 상황 — 관리자 응답에 쓴다. */
    @Query(
            value =
                    """
                   SELECT
                     count(*) FILTER (WHERE p.translated_at IS NOT NULL)      AS attempted,
                     count(*) FILTER (WHERE p.name_en IS NOT NULL)            AS named,
                     count(*)                                                 AS total
                   FROM popup_store p
                   WHERE p.name IS NOT NULL AND p.name <> ''
                   """,
            nativeQuery = true)
    Object[] countTranslationProgress();

    /* ============================================================
     *  어드민 대시보드 — 자동수집 메트릭 (v2.10)
     * ============================================================ */

    /** 특정 시각 이후로 자동수집된 row 갯수. */
    @Query(
            "SELECT COUNT(p) FROM PopupStore p "
                    + "WHERE p.sourceType = 'CRAWLED' AND p.crawledAt >= :since")
    long countCrawledSince(@Param("since") java.time.LocalDateTime since);

    /** 특정 시각 이후 자동수집 row 의 평균 신뢰도. row 가 없으면 0. */
    @Query(
            "SELECT COALESCE(AVG(p.confidenceScore), 0) FROM PopupStore p "
                    + "WHERE p.sourceType = 'CRAWLED' AND p.crawledAt >= :since")
    java.math.BigDecimal averageConfidenceSince(@Param("since") java.time.LocalDateTime since);

    /** 어드민 검수 대기열 크기. */
    @Query("SELECT COUNT(p) FROM PopupStore p WHERE p.reviewStatus = 'PENDING_REVIEW'")
    long countPendingReview();

    @Query(
            "SELECT p FROM PopupStore p WHERE p.takedownRequestedAt IS NOT NULL "
                    + "AND (p.reviewStatus IS NULL OR p.reviewStatus <> 'TAKEDOWN') "
                    + "ORDER BY p.takedownRequestedAt ASC")
    List<PopupStore> findPendingTakedown(Pageable pageable);

    /**
     * Takedown SLA 알림용. 권리자 신고가 접수됐지만 admin 이 24시간 안에 결정(임시 차단·영구 삭제·수정·신고 거부)하지 못한 검증 대기 row를 센다.
     *
     * <p>기준 시각을 {@code lastSeenAt} → {@code takedownRequestedAt} 으로 바로잡았다. {@code lastSeenAt} 은
     * 크롤러가 원본 글을 마지막으로 본 시각이라, 소스 블로그에 글이 살아 있으면 계속 갱신된다. 그러면 차단된 지 며칠이 지나도 cutoff 를 넘지 않아 <b>알림이
     * 영원히 울리지 않았다</b> — "24시간 내 검토" 약속(약관 §11)이 조용히 깨진다. SLA 는 "언제 신고됐나" 로 재야 한다.
     */
    @Query(
            "SELECT COUNT(p) FROM PopupStore p WHERE p.takedownRequestedAt < :cutoff "
                    + "AND (p.reviewStatus IS NULL OR p.reviewStatus <> 'TAKEDOWN')")
    long countTakedownOlderThan(@Param("cutoff") java.time.LocalDateTime cutoff);
}
