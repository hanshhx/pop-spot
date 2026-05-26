package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.FeedbackReplyRequestDto;
import com.example.popspotbackend.dto.FeedbackResponseDto;
import com.example.popspotbackend.service.FeedbackService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 의견 보내기 검수 / 답변용 어드민 API.
 *
 * <p>{@code /api/admin/**} 는 {@code SecurityConfig} 에서 이미 {@code hasRole('ADMIN')} 으로 가드되어 있고, 클래스
 * 단 {@code @PreAuthorize} 로 한 번 더 명시한다. 응답 매핑/검증은 모두 {@link FeedbackService} 위임.
 */
@RestController
@RequestMapping("/api/admin/feedback")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminFeedbackController {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 50;
    private static final String RESPONSE_STATUS_DELETED = "DELETED";

    private final FeedbackService feedbackService;

    @GetMapping
    public ResponseEntity<List<FeedbackResponseDto>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "" + DEFAULT_PAGE) int page,
            @RequestParam(defaultValue = "" + DEFAULT_SIZE) int size) {
        return ResponseEntity.ok(feedbackService.findForAdmin(status, page, size));
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Long>> metrics() {
        return ResponseEntity.ok(feedbackService.countByStatus());
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<FeedbackResponseDto> reply(
            @PathVariable Long id, @Valid @RequestBody FeedbackReplyRequestDto dto) {
        return ResponseEntity.ok(feedbackService.reply(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable Long id) {
        feedbackService.deleteById(id);
        return ResponseEntity.ok(Map.of("status", RESPONSE_STATUS_DELETED, "id", id));
    }
}
