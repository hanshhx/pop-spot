package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MyPageDto;
import com.example.popspotbackend.service.MyPageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 요약 API.
 *
 * <p>실제 로직은 {@link MyPageService} 가 처리하며, 컨트롤러는 URL 매핑만 담당. 예외 처리는 {@link
 * com.example.popspotbackend.exception.GlobalExceptionHandler} 가 전역 변환.
 *
 * <p>보안(v2.22): path 의 userId 가 JWT 토큰 본인과 일치할 때만 통과(WishlistController 와 동일한
 * requireSelf 패턴). 이전엔 검사가 없어 누구나 {@code /api/mypage/{타인ID}} 로 남의 프리미엄/확성기/스탬프
 * 수를 전수 조회할 수 있었다(IDOR).
 */
@Slf4j
@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
public class MyPageController {

    private final MyPageService myPageService;

    @GetMapping("/{userId}")
    public ResponseEntity<MyPageDto> getMyPageInfo(
            Authentication authentication, @PathVariable String userId) {
        requireSelf(authentication, userId);
        return ResponseEntity.ok(myPageService.findMyPageData(userId));
    }

    /** path 의 userId 가 인증된 본인인지 확인. 미인증 / 불일치 모두 거부. */
    private void requireSelf(Authentication authentication, String pathUserId) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null) {
            throw new SecurityException("로그인이 필요합니다.");
        }
        if (!authentication.getName().equals(pathUserId)) {
            throw new SecurityException("본인 정보만 조회할 수 있습니다.");
        }
    }
}
