package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.Stamp;
import com.example.popspotbackend.service.StampService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 팝업 방문 스탬프 적립 API. 중복 적립은 서비스 계층의 unique 제약으로 차단된다.
 *
 * <p>보안(v2.22): userId 는 요청 파라미터가 아니라 JWT 토큰(Authentication)에서만 가져온다. 이전엔
 * {@code @RequestParam userId} 라 비로그인 사용자가 남의 ID 로 스탬프/확성기 보상을 임의 적립할 수
 * 있었다(IDOR).
 */
@Slf4j
@RestController
@RequestMapping("/api/stamps")
@RequiredArgsConstructor
public class StampController {

    private final StampService stampService;

    @PostMapping
    public ResponseEntity<String> addStamp(
            Authentication authentication, @RequestParam("popupId") Long popupId) {
        String userId = requireUserId(authentication);
        try {
            stampService.addStamp(userId, popupId);
            return ResponseEntity.ok("스탬프 획득 성공 (팝업 ID: " + popupId + ")");
        } catch (IllegalArgumentException e) {
            // 어뷰징 방어(하루 1회 / 동일 팝업 중복) 등 사용자 입력성 오류만 메시지 노출.
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/my")
    public ResponseEntity<List<Stamp>> getMyStamps(Authentication authentication) {
        return ResponseEntity.ok(stampService.getMyStamps(requireUserId(authentication)));
    }

    /** JWT 토큰에서 userId 추출. 미인증이면 거부(GlobalExceptionHandler 가 401/403 으로 변환). */
    private String requireUserId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            throw new SecurityException("로그인이 필요합니다.");
        }
        return authentication.getName();
    }
}
