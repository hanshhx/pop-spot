package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Wishlist;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WishlistRepository extends JpaRepository<Wishlist, Long> {

    // 🔥 [수정] popupStore + popupStore.images 까지 fetch — open-in-view=false 환경에서 JSON 직렬화 시 LazyInit
    // 방어
    @EntityGraph(attributePaths = {"popupStore", "popupStore.images"})
    List<Wishlist> findAllByUser_UserIdOrderByIdDesc(String userId);

    // 🔥 [수정] 명확한 경로 지정 (User_UserId, PopupStore_Id)
    boolean existsByUser_UserIdAndPopupStore_Id(String userId, Long popupStoreId);

    // 🔥 [수정] 명확한 경로 지정
    Optional<Wishlist> findByUser_UserIdAndPopupStore_Id(String userId, Long popupStoreId);

    // 🔥 [22번 임의 수정] 찜 개수 역시 전체 데이터를 가져오지 않고 DB에서 숫자만 카운트합니다.
    int countByUser_UserId(String userId);

    /**
     * v2.18.1 — 위시 만료 D-3 알림 cron 용.
     *
     * <p>특정 ISO 날짜 (yyyy-MM-dd) 에 종료되는 팝업을 찜한 모든 위시리스트 + 사용자 정보를 한
     * 번에 가져온다. EntityGraph 로 popupStore + user 까지 fetch — 메일 발송 시 LazyInit 방지.
     */
    @EntityGraph(attributePaths = {"popupStore", "user"})
    @Query("SELECT w FROM Wishlist w WHERE w.popupStore.endDate = :targetDate")
    List<Wishlist> findWithUserAndPopupByEndDate(@Param("targetDate") String targetDate);
}
