package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.WishlistResponseDto;
import com.example.popspotbackend.service.WishlistService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 위시리스트 토글 / 조회. 응답 문자열로 ADDED / REMOVED 를 구분.
 *
 * <p>v2.9 보안: path 의 {@code userId} 가 토큰 subject 와 일치할 때만 통과. 불일치는 403 (IDOR 차단).
 */
@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    @PostMapping("/{userId}/{popupId}")
    public ResponseEntity<String> toggleWishlist(
            Authentication authentication,
            @PathVariable String userId,
            @PathVariable Long popupId) {
        requireSelf(authentication, userId);
        return ResponseEntity.ok(wishlistService.toggleWishlist(userId, popupId));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<WishlistResponseDto>> getMyWishlist(
            Authentication authentication, @PathVariable String userId) {
        requireSelf(authentication, userId);
        return ResponseEntity.ok(wishlistService.getMyWishlist(userId));
    }

    /** path 의 userId 가 인증된 본인인지 확인. 미인증 / 불일치 모두 거부. */
    private void requireSelf(Authentication authentication, String pathUserId) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null) {
            throw new SecurityException("인증된 사용자만 위시리스트에 접근할 수 있습니다.");
        }
        if (!authentication.getName().equals(pathUserId)) {
            throw new SecurityException("본인 위시리스트만 조회/수정할 수 있습니다.");
        }
    }
}
