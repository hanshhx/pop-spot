package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.WishlistResponseDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.entity.Wishlist;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 위시리스트 토글 / 조회. 토글 결과는 클라이언트가 분기할 수 있도록 ADDED / REMOVED 문자열로 반환. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WishlistService {

    private static final String RESULT_ADDED = "ADDED";
    private static final String RESULT_REMOVED = "REMOVED";

    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;
    private final PopupStoreRepository popupStoreRepository;

    @Transactional
    public String toggleWishlist(String userId, Long popupStoreId) {
        if (wishlistRepository.existsByUser_UserIdAndPopupStore_Id(userId, popupStoreId)) {
            removeExisting(userId, popupStoreId);
            return RESULT_REMOVED;
        }
        addNew(userId, popupStoreId);
        return RESULT_ADDED;
    }

    public List<WishlistResponseDto> getMyWishlist(String userId) {
        return wishlistRepository.findAllByUser_UserIdOrderByIdDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    /* ============================== 내부 헬퍼 ============================== */

    private void removeExisting(String userId, Long popupStoreId) {
        Wishlist wishlist =
                wishlistRepository
                        .findByUser_UserIdAndPopupStore_Id(userId, popupStoreId)
                        .orElseThrow(() -> new IllegalArgumentException("찜 정보가 없습니다."));
        wishlistRepository.delete(wishlist);
    }

    private void addNew(String userId, Long popupStoreId) {
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> new IllegalArgumentException("유저 없음"));
        PopupStore popup =
                popupStoreRepository
                        .findById(popupStoreId)
                        .orElseThrow(() -> new IllegalArgumentException("팝업 없음"));
        wishlistRepository.save(Wishlist.builder().user(user).popupStore(popup).build());
    }

    private WishlistResponseDto toResponse(Wishlist w) {
        PopupStore popup = w.getPopupStore();
        return WishlistResponseDto.builder()
                .wishlistId(w.getId())
                .popupId(popup.getId())
                .popupName(popup.getName())
                .popupImage(popup.getImageUrl())
                .location(popup.getLocation())
                .startDate(popup.getStartDate().toString())
                .endDate(popup.getEndDate().toString())
                .build();
    }
}
