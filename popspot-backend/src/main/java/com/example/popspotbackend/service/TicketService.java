package com.example.popspotbackend.service;

import jakarta.annotation.PreDestroy; // 🔥 [추가] 종료 처리를 위해 필요
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicketService {

    private final StringRedisTemplate redisTemplate;

    // 🔥 [수정 1] 스레드 풀 개수 최적화 (50 -> 10)
    // 기존 50개는 t2.micro(1GB RAM) 같은 저사양 서버에서 OOM(메모리 부족)을 유발할 수 있습니다.
    // 10개로 줄여도 봇 5마리 시뮬레이션에는 충분합니다.
    private final ExecutorService executorService = Executors.newFixedThreadPool(10);

    public void resetGame(String itemId) {
        String key = "ticket:stock:" + itemId;
        redisTemplate.opsForValue().set(key, "30");
        log.info("🎟️ [시뮬레이션] {} 리셋 완료. 재고 30개", itemId);
    }

    public void startSimulation(String itemId) {
        String key = "ticket:stock:" + itemId;

        // 🔥 [기존 로직 유지] 봇 5마리가 동시에 미친듯이 클릭하는 상황 연출
        for(int i=0; i<5; i++) {
            executorService.submit(() -> {
                try {
                    while (true) {
                        String currentStockStr = redisTemplate.opsForValue().get(key);
                        if (currentStockStr == null || Integer.parseInt(currentStockStr) <= 0) break;

                        // 🔥 [기존 로직 유지] 딜레이를 0.05초~0.1초로 극단적으로 줄임
                        // 거의 1초에 10~20개씩 빠집니다.
                        Thread.sleep((long) (50 + Math.random() * 100));

                        redisTemplate.opsForValue().decrement(key);
                        log.info("📉 [봇 광클] 재고 감소!");
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });
        }
    }

    // (기존 메서드 유지)
    public String attemptReservation(String userId, String itemId) {
        String key = "ticket:stock:" + itemId;
        Long stock = redisTemplate.opsForValue().decrement(key);

        if (stock != null && stock >= 0) {
            log.info("🎉 USER [{}] 최종 성공! (남은 재고: {})", userId, stock);
            return "SUCCESS";
        } else {
            log.info("😭 USER [{}] 최종 실패... (매진)", userId);
            return "FAIL";
        }
    }

    public String getStock(String itemId) {
        String key = "ticket:stock:" + itemId;
        return redisTemplate.opsForValue().get(key);
    }

    // 🔥 [추가] 서버 종료 시 스레드 풀 정리 (메모리 누수 방지)
    @PreDestroy
    public void cleanup() {
        log.info("TicketService 스레드 풀 안전 종료 중...");
        executorService.shutdown();
    }

    // (기존 메서드들 - 사용하지 않는다면 비워둠)
    public void triggerBots(String itemId, int botCount) { /* ... */ }
    public String attemptTicket(String userId, String itemId) { return attemptReservation(userId, itemId); }
    public void resetGame(String itemId, int stock) { resetGame(itemId); }
    public void triggerClusterBots(String userTargetId, int totalBotCount) { /* ... */ }
}