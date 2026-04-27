package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.PopupStore;
// 🔥 [임의 수정] 한 번의 쿼리로 연관된 데이터를 가져오기 위한 어노테이션 추가
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

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
     * 인기 팝업 — DB 단에서 PENDING 제외 + viewCount 정렬 + LIMIT.
     *  메모리에 전체 row 를 끌어와서 sort/filter 하던 기존 로직을 대체.
     */
    @EntityGraph(attributePaths = {"images"})
    @Query("SELECT p FROM PopupStore p WHERE (p.status IS NULL OR p.status <> 'PENDING') ORDER BY COALESCE(p.viewCount, 0) DESC")
    List<PopupStore> findTrending(Pageable pageable);

    /**
     * 비-PENDING 전체 (페이징/정렬은 호출자에서 결정)
     */
    @EntityGraph(attributePaths = {"images"})
    @Query("SELECT p FROM PopupStore p WHERE p.status IS NULL OR p.status <> 'PENDING'")
    List<PopupStore> findAllVisible();
}