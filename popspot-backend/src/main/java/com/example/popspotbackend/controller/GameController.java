package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class GameController {

    private final TicketService ticketService;

    // 1. 시뮬레이션 시작 (사용자가 '시작' 누르면 호출)
    // 재고를 리셋하고, 봇들을 바로 출발시킵니다. 사용자는 이제 서둘러야 합니다.
    @PostMapping("/start")
    public ResponseEntity<String> startSimulation(@RequestParam String itemId) {
        ticketService.resetGame(itemId);    // 1. 재고 30개로 리셋
        ticketService.startSimulation(itemId); // 2. 봇들 출발 (비동기)
        return ResponseEntity.ok("START");
    }

    // 2. 최종 예매 요청 (사용자가 모든 단계 끝내고 호출)
    @PostMapping("/reserve")
    public ResponseEntity<Map<String, String>> reserve(@RequestParam String userId, @RequestParam String itemId) {
        String result = ticketService.attemptReservation(userId, itemId);
        return ResponseEntity.ok(Map.of("result", result));
    }

    // 3. 실시간 재고 확인
    @GetMapping("/stock")
    public ResponseEntity<String> getStock(@RequestParam String itemId) {
        String stock = ticketService.getStock(itemId);
        return ResponseEntity.ok(stock != null ? stock : "0");
    }
}