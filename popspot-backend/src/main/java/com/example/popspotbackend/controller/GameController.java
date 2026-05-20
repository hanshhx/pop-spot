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
 * <p>{@code /start} 호출 시 재고 리셋 + 봇 비동기 발사로 실제 티켓팅 압박감 재현.
 *
 * <p>예약 userId 는 토큰 subject 에서 강제 추출 (이전 {@code @RequestParam} 방식은 IDOR 취약).
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

    /** 미인증 호출은 {@link SecurityException} → GlobalExceptionHandler 403. */
    private String requireAuthenticatedUserId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null) {
            throw new SecurityException("인증된 사용자만 티켓 예약이 가능합니다.");
        }
        return authentication.getName();
    }
}
