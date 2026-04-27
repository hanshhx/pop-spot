package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface WishlistRepository extends JpaRepository<Wishlist, Long> {

    // 🔥 [수정] User 객체 안의 userId 필드를 찾도록 언더바(_) 추가
    List<Wishlist> findAllByUser_UserIdOrderByIdDesc(String userId);

    // 🔥 [수정] 명확한 경로 지정 (User_UserId, PopupStore_Id)
    boolean existsByUser_UserIdAndPopupStore_Id(String userId, Long popupStoreId);

    // 🔥 [수정] 명확한 경로 지정
    Optional<Wishlist> findByUser_UserIdAndPopupStore_Id(String userId, Long popupStoreId);

    // 🔥 [22번 임의 수정] 찜 개수 역시 전체 데이터를 가져오지 않고 DB에서 숫자만 카운트합니다.
    int countByUser_UserId(String userId);
}