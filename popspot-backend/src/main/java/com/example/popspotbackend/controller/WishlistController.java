package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.WishlistResponseDto;
import com.example.popspotbackend.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "https://popspot.duckdns.org"})
public class WishlistController {

    private final WishlistService wishlistService;

    // 1. 찜 토글 (추가/삭제)
    // 유저 ID는 String, 팝업 ID는 Long
    @PostMapping("/{userId}/{popupId}")
    public ResponseEntity<String> toggleWishlist(@PathVariable String userId, @PathVariable Long popupId) {
        String result = wishlistService.toggleWishlist(userId, popupId);
        return ResponseEntity.ok(result);
    }

    // 2. 내 위시리스트 조회
    // 유저 ID는 String
    @GetMapping("/{userId}")
    public ResponseEntity<List<WishlistResponseDto>> getMyWishlist(@PathVariable String userId) {
        return ResponseEntity.ok(wishlistService.getMyWishlist(userId));
    }
}