package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.TicketService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 티켓팅 시뮬레이션 게임 API.
 *
 * <p>{@code /start} 호출 시 재고를 리셋하고 봇들을 비동기로 출발시켜 실제 티켓팅 같은 압박감을 만든다.
 *
 * <p>예약 호출은 인증된 사용자 본인 명의로만 가능하다 — 즉, userId 는 토큰의 subject 에서 가져오고 클라이언트가
 * 보낸 파라미터는 신뢰하지 않는다. 이전 구현은 {@code @RequestParam String userId} 를 그대로 받아 다른 사용자
 * ID 로 티켓을 선점할 수 있었다 (IDOR).
 */
@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameController {

    private static final String DEFAULT_STOCK_WHEN_MISSING = "0";

    private final TicketService ticketService;

    @PostMapping("/start")
    public ResponseEntity<String> startSimulation(@RequestParam String itemId) {
        ticketService.resetGame(itemId);
        ticketService.startSimulation(itemId);
        return ResponseEntity.ok("START");
    }

    @PostMapping("/reserve")
    public ResponseEntity<Map<String, String>> reserve(
            Authentication authentication, @RequestParam String itemId) {
        String userId = requireAuthenticatedUserId(authentication);
        String result = ticketService.attemptReservation(userId, itemId);
        return ResponseEntity.ok(Map.of("result", result));
    }

    @GetMapping("/stock")
    public ResponseEntity<String> getStock(@RequestParam String itemId) {
        String stock = ticketService.getStock(itemId);
        return ResponseEntity.ok(stock != null ? stock : DEFAULT_STOCK_WHEN_MISSING);
    }

    /**
     * Spring Security 필터가 authenticated 토큰을 세팅했어야 한다. 미인증으로 들어오면 401 처리될 수 있도록
     * AuthenticationCredentialsNotFoundException 을 던지지 않고 SecurityException 으로 격상 — GlobalExceptionHandler
     * 가 403 으로 응답.
     */
    private String requireAuthenticatedUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            throw new SecurityException("인증된 사용자만 티켓 예약이 가능합니다.");
        }
        return authentication.getName();
    }
}
