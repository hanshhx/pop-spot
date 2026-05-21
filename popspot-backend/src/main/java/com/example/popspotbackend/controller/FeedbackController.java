package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.FeedbackCreateRequestDto;
import com.example.popspotbackend.dto.FeedbackResponseDto;
import com.example.popspotbackend.service.FeedbackService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사용자가 보내는 의견 보내기 API.
 *
 * <p>{@code POST /api/feedback} 은 비로그인 게스트도 호출할 수 있고, 로그인 사용자가 호출하면 토큰의 subject 를
 * {@code userId} 로 저장한다. {@code GET /api/feedback/me} 는 본인 인증이 있을 때만 동작.
 */
@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<FeedbackResponseDto> submit(
            Authentication authentication, @Valid @RequestBody FeedbackCreateRequestDto dto) {
        String userId = authenticatedUserId(authentication);
        return ResponseEntity.ok(feedbackService.submit(dto, userId));
    }

    @GetMapping("/me")
    public ResponseEntity<List<FeedbackResponseDto>> getMine(Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            throw new SecurityException("로그인한 사용자만 본인 의견을 조회할 수 있습니다.");
        }
        return ResponseEntity.ok(feedbackService.findMine(userId));
    }

    /** 인증이 없으면 null 을 돌려준다 — 게스트 작성 허용을 위해 예외를 던지지 않음. */
    private String authenticatedUserId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            return null;
        }
        return authentication.getName();
    }
}
