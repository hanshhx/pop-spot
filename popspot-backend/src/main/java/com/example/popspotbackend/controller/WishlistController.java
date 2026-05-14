package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.WishlistResponseDto;
import com.example.popspotbackend.service.WishlistService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 위시리스트 토글 / 조회. 응답 문자열로 ADDED / REMOVED 를 구분한다. */
@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    @PostMapping("/{userId}/{popupId}")
    public ResponseEntity<String> toggleWishlist(
            @PathVariable String userId, @PathVariable Long popupId) {
        return ResponseEntity.ok(wishlistService.toggleWishlist(userId, popupId));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<WishlistResponseDto>> getMyWishlist(@PathVariable String userId) {
        return ResponseEntity.ok(wishlistService.getMyWishlist(userId));
    }
}
