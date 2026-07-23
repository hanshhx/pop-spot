package com.example.popspotbackend.service;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 티켓팅 시뮬레이션 — 봇이 광클하는 환경에서 사용자가 마지막 자리를 잡을 수 있을지 시험한다.
 *
 * <p>스레드 풀은 {@value #BOT_THREAD_POOL_SIZE}개로 제한 (저사양 VM 에서 OOM 방지). 봇은 {@value #BOT_COUNT} 마리가 동시에
 * 클릭하며 매 시도 사이 50~150ms 의 짧은 휴식을 둔다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketService {

    private static final int BOT_THREAD_POOL_SIZE = 10;
    private static final int BOT_COUNT = 5;
    private static final int INITIAL_STOCK = 30;

    private static final long BOT_BASE_DELAY_MS = 50;
    private static final long BOT_RANDOM_DELAY_MS = 100;

    private static final String STOCK_KEY_PREFIX = "ticket:stock:";
    private static final String RESULT_SUCCESS = "SUCCESS";
    private static final String RESULT_FAIL = "FAIL";
    private static final String RUNNING_KEY_PREFIX = "ticket:running:";

    private final StringRedisTemplate redisTemplate;
    private final ExecutorService executorService =
            new ThreadPoolExecutor(
                    BOT_THREAD_POOL_SIZE,
                    BOT_THREAD_POOL_SIZE,
                    0L,
                    TimeUnit.MILLISECONDS,
                    new ArrayBlockingQueue<>(50),
                    new ThreadPoolExecutor.AbortPolicy());

    public void resetGame(String itemId) {
        validateItemId(itemId);
        redisTemplate.opsForValue().set(stockKey(itemId), String.valueOf(INITIAL_STOCK));
        log.info("[Ticket] {} 리셋 완료. 재고 {}개", itemId, INITIAL_STOCK);
    }

    /** 봇 {@value #BOT_COUNT} 마리가 동시에 재고를 깎기 시작한다. */
    public void startSimulation(String itemId) {
        validateItemId(itemId);
        Boolean acquired =
                redisTemplate
                        .opsForValue()
                        .setIfAbsent(RUNNING_KEY_PREFIX + itemId, "1", 2, TimeUnit.MINUTES);
        if (!Boolean.TRUE.equals(acquired)) {
            throw new IllegalStateException("이미 실행 중인 게임입니다.");
        }
        String key = stockKey(itemId);
        for (int i = 0; i < BOT_COUNT; i++) {
            executorService.submit(() -> runBotLoop(key));
        }
    }

    public String attemptReservation(String userId, String itemId) {
        validateItemId(itemId);
        Long stock = redisTemplate.opsForValue().decrement(stockKey(itemId));
        if (stock != null && stock >= 0) {
            log.info("[Ticket] USER {} 성공 (남은 재고: {})", userId, stock);
            return RESULT_SUCCESS;
        }
        log.info("[Ticket] USER {} 실패 (매진)", userId);
        return RESULT_FAIL;
    }

    public String getStock(String itemId) {
        return redisTemplate.opsForValue().get(stockKey(itemId));
    }

    @PreDestroy
    public void cleanup() {
        log.info("[Ticket] 스레드 풀 안전 종료 중");
        executorService.shutdown();
    }

    /* ============================== 내부 헬퍼 ============================== */

    private String stockKey(String itemId) {
        return STOCK_KEY_PREFIX + itemId;
    }

    private void validateItemId(String itemId) {
        if (itemId == null || !itemId.matches("^[A-Za-z0-9_-]{1,64}$")) {
            throw new IllegalArgumentException("유효하지 않은 게임 상품 ID입니다.");
        }
    }

    private void runBotLoop(String key) {
        try {
            while (true) {
                String current = redisTemplate.opsForValue().get(key);
                if (current == null || Integer.parseInt(current) <= 0) break;
                Thread.sleep((long) (BOT_BASE_DELAY_MS + Math.random() * BOT_RANDOM_DELAY_MS));
                redisTemplate.opsForValue().decrement(key);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /* ============================== 레거시 호환 ============================== */

    public void triggerBots(String itemId, int botCount) {
        // 사용되지 않지만 외부 호출 호환을 위해 메서드만 유지.
    }

    public String attemptTicket(String userId, String itemId) {
        return attemptReservation(userId, itemId);
    }

    public void resetGame(String itemId, int stock) {
        resetGame(itemId);
    }

    public void triggerClusterBots(String userTargetId, int totalBotCount) {
        // legacy 호환용 no-op.
    }
}
