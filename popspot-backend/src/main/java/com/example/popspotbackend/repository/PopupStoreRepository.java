package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.PopupStore;
// 🔥 [임의 수정] 한 번의 쿼리로 연관된 데이터를 가져오기 위한 어노테이션 추가
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
            "SELECT p FROM PopupStore p WHERE (p.status IS NULL OR p.status <> 'PENDING') ORDER BY COALESCE(p.viewCount, 0) DESC")
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
     * "보여줄 수 있는" 팝업의 통일 필터. - status NOT IN ('PENDING','EXPIRED') - review_status 가 NULL(레거시
     * manual) / AUTO_PUBLISHED / APPROVED 만 노출 - PENDING_REVIEW / REJECTED / TAKEDOWN 은 차단
     */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE (p.status IS NULL OR p.status NOT IN ('PENDING','EXPIRED'))
              AND (p.reviewStatus IS NULL OR p.reviewStatus IN ('AUTO_PUBLISHED','APPROVED'))
           """)
    List<PopupStore> findAllPublic();

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

    /** 인기 팝업 — public 한 것만 (자동게시 + 수동 둘 다 포함, 만료 제외) */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            """
           SELECT p FROM PopupStore p
            WHERE (p.status IS NULL OR p.status NOT IN ('PENDING','EXPIRED'))
              AND (p.reviewStatus IS NULL OR p.reviewStatus IN ('AUTO_PUBLISHED','APPROVED'))
            ORDER BY COALESCE(p.viewCount, 0) DESC
           """)
    List<PopupStore> findTrendingPublic(Pageable pageable);

    /** admin 검수 큐 (신뢰도 낮음) */
    @EntityGraph(attributePaths = {"images"})
    @Query(
            "SELECT p FROM PopupStore p WHERE p.reviewStatus = 'PENDING_REVIEW' ORDER BY p.crawledAt DESC")
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
}
