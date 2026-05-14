package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.TicketService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 티켓팅 시뮬레이션 게임 API.
 *
 * <p>{@code /start} 호출 시 재고를 리셋하고 봇들을 비동기로 출발시켜 실제 티켓팅 같은 압박감을 만든다.
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
            @RequestParam String userId, @RequestParam String itemId) {
        String result = ticketService.attemptReservation(userId, itemId);
        return ResponseEntity.ok(Map.of("result", result));
    }

    @GetMapping("/stock")
    public ResponseEntity<String> getStock(@RequestParam String itemId) {
        String stock = ticketService.getStock(itemId);
        return ResponseEntity.ok(stock != null ? stock : DEFAULT_STOCK_WHEN_MISSING);
    }
}
