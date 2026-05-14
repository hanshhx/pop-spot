package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Wishlist;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
