package com.example.popspotbackend.admin.log;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 어드민 콘솔용 실시간 로그 SSE 엔드포인트.
 *
 * <p>인증은 <b>{@code Authorization} 헤더로만</b> 받는다. 프론트가 {@code EventSource} 대신 {@code fetch()} 스트리밍을
 * 쓰기 때문이다(useSseStream.ts). EventSource 는 커스텀 헤더를 못 보내 토큰을 URL 에 실어야 하는데, 그러면 프록시·서버 접근 로그에 관리자 토큰이
 * 그대로 남는다.
 *
 * <p><b>이 경로는 Vercel 을 거치지 않는다</b> — 프론트가 백엔드를 직접 부른다(api.ts 의 API_BASE_URL). 앞단에 방화벽을 두더라도 여기는 지나지
 * 않으므로, 접근 제어는 이 애플리케이션이 스스로 해야 한다.
 */
@RestController
@RequestMapping("/api/admin/logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class LogTailController {

    private final LogTailService logTailService;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return logTailService.subscribe(currentUserId());
    }

    /** 이 스트림의 주인. 비상 스위치가 <b>누구의</b> 스트림을 끊을지 알려면 필요하다. */
    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : auth.getName();
    }
}
