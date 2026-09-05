package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.WishlistResponseDto;
import com.example.popspotbackend.service.WishlistService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 위시리스트 토글 / 빼기 / 조회. 응답 문자열로 ADDED · REMOVED · ABSENT 를 구분.
 *
 * <p>v2.9 보안: path 의 {@code userId} 가 토큰 subject 와 일치할 때만 통과. 불일치는 403 (IDOR 차단).
 */
@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
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

    /**
     * 찜 빼기. <b>없어도 200</b> 이다 — 자세한 이유는 {@link WishlistService#removeWishlist}.
     *
     * <p>이 매핑은 여태 <b>없었다.</b> 그런데 웹(마이팝 목록의 빼기)과 앱(상세 하트 끄기)은 이미 {@code DELETE} 를 부르고 있어서 405 로
     * 떨어졌고, 두 화면 모두 {@code res.ok} 만 보고 분기하므로 <b>눌러도 아무 일이 없었다.</b> 토글로 대신하지 않는 이유는 서비스 주석 참고.
     */
    @DeleteMapping("/{userId}/{popupId}")
    public ResponseEntity<String> removeWishlist(
            Authentication authentication,
            @PathVariable String userId,
            @PathVariable Long popupId) {
        requireSelf(authentication, userId);
        return ResponseEntity.ok(wishlistService.removeWishlist(userId, popupId));
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
                || authentication.getName() == null
                // Spring 익명 인증은 isAuthenticated() 가 참이고 이름이 "anonymousUser" 다. 바로 뒤의
                // 본인 확인이 남의 데이터는 막지만, 이 검사가 없으면 비로그인 요청이 그 이름으로
                // 자기 몫을 쓸 수 있다. 컨트롤러마다 규칙이 갈리지 않게 여기서도 걸러낸다.
                || "anonymousUser".equals(authentication.getName())) {
            throw new SecurityException("인증된 사용자만 위시리스트에 접근할 수 있습니다.");
        }
        if (!authentication.getName().equals(pathUserId)) {
            throw new SecurityException("본인 위시리스트만 조회/수정할 수 있습니다.");
        }
    }
}
