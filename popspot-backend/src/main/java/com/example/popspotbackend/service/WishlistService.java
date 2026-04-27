package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.entity.Wishlist;
import com.example.popspotbackend.dto.WishlistResponseDto;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;
    private final PopupStoreRepository popupStoreRepository;

    // 1. 찜 하기 / 취소 하기 (토글 기능)
    @Transactional
    public String toggleWishlist(String userId, Long popupStoreId) {

        // 🔥 [수정] 바뀐 리포지토리 메서드 이름(User_UserId...) 사용
        if (wishlistRepository.existsByUser_UserIdAndPopupStore_Id(userId, popupStoreId)) {

            Wishlist wishlist = wishlistRepository.findByUser_UserIdAndPopupStore_Id(userId, popupStoreId)
                    .orElseThrow(() -> new IllegalArgumentException("찜 정보가 없습니다."));

            wishlistRepository.delete(wishlist);
            return "REMOVED";
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

            PopupStore popupStore = popupStoreRepository.findById(popupStoreId)
                    .orElseThrow(() -> new IllegalArgumentException("팝업 없음"));

            wishlistRepository.save(Wishlist.builder().user(user).popupStore(popupStore).build());
            return "ADDED";
        }
    }

    // 2. 내 위시리스트 목록 조회
    public List<WishlistResponseDto> getMyWishlist(String userId) {
        // 🔥 [수정] 바뀐 리포지토리 메서드 이름 사용
        return wishlistRepository.findAllByUser_UserIdOrderByIdDesc(userId).stream()
                .map(w -> WishlistResponseDto.builder()
                        .wishlistId(w.getId())
                        .popupId(w.getPopupStore().getId())
                        .popupName(w.getPopupStore().getName())
                        .popupImage(w.getPopupStore().getImageUrl())
                        .location(w.getPopupStore().getLocation())
                        .startDate(w.getPopupStore().getStartDate().toString())
                        .endDate(w.getPopupStore().getEndDate().toString())
                        .build())
                .collect(Collectors.toList());
    }
}