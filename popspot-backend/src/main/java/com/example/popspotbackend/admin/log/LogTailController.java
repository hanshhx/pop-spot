package com.example.popspotbackend.admin.log;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 어드민 콘솔용 실시간 로그 SSE 엔드포인트.
 *
 * <p>{@code EventSource} 가 커스텀 헤더를 보낼 수 없어 JWT 는 query string 으로 받는다 — {@code
 * JwtAuthenticationFilter} 가 이 경로에 한해 {@code ?token=} 폴백을 허용한다.
 */
@RestController
@RequestMapping("/api/admin/logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class LogTailController {

    private final LogTailService logTailService;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return logTailService.subscribe();
    }
}
