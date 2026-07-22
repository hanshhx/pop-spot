package com.example.popspotbackend.service.crawler;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 로컬 Ollama 로 크롤에 쓴 하루 시간을 추적한다(기본 상한 3시간).
 *
 * <p><b>왜 필요한가.</b> PC(4060 Ti)를 하루 종일 켜둬도 크롤이 종일 GPU 를 잡으면 부담이다. 그래서 하루 크롤 시간을 예산으로 묶는다 — PC 를 껐다
 * 켜도 누적이 이어지고, 예산을 다 쓰면 그날은 더 돌지 않는다. 커서 덕분에 다음 날 이어서 순회한다.
 *
 * <p><b>Redis 영속(재시작 생존).</b> 예전엔 메모리(AtomicLong)라 백엔드가 하루에 여러 번 재시작되면 카운터가 0 으로 리셋됐다 — 재배포·크래시가
 * 겹치면 3시간 예산을 몇 배로 넘길 수 있었다. 이제 KST 날짜를 키에 넣은 Redis 카운터({@code
 * crawl:budget:used-seconds:YYYY-MM-DD})에 누적한다. 재시작해도 이어지고, 키에 날짜가 있어 자정이 지나면 새 키(=0)로 자연 리셋된다 — 별도
 * 리셋 스케줄러가 필요 없다({@code LlmUsageTracker.keyOf} 와 같은 발상).
 *
 * <p><b>Redis 불가 시 폴백.</b> Redis 기준값을 먼저 읽고, 장애 중 증가분은 {@code pendingSeconds} 로 별도 보관한다. 복구되면 미동기화
 * 증가분 전량을 원자적 INCR 로 합친다. 단순 {@code max(redis, mirror)} 는 재시작 뒤 장애가 끼면 서로 겹치지 않는 두 구간 중 하나를 잃으므로
 * 사용하지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CrawlBudgetTracker {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final String KEY_PREFIX = "crawl:budget:used-seconds:";

    /** 날짜별 키의 자동 정리용 TTL. 날짜-키가 리셋을 담당하므로 넉넉히 잡아 자정 경계 걸침만 방지한다. */
    private static final long KEY_TTL_DAYS = 2;

    /** Spring Boot 오토컨피그 빈. 앱 전역(TicketService · AuthController 등)이 이미 이 타입을 쓴다. */
    private final StringRedisTemplate redis;

    /** 하루 로컬 크롤 예산(분). 3시간이면 로컬 처리량으로 신규 팝업을 다 잡고도 남는다. */
    @Value("${popspot.crawler.local.daily-budget-minutes:180}")
    private int dailyBudgetMinutes;

    /** Redis 기준값과 이 JVM 증가분을 합친 보수적 총량. */
    private volatile LocalDate mirrorDay = LocalDate.now(SEOUL);

    private long mirrorSeconds;
    private long pendingSeconds;
    private boolean redisBaselineLoaded;

    /** 오늘 예산이 남았는가. */
    public synchronized boolean hasBudgetLeft() {
        return currentUsedSeconds() < dailyBudgetMinutes * 60L;
    }

    /** 이번 크롤이 쓴 시간을 누적한다. 미러에 항상 더하고, Redis 에는 best-effort 로 누적한다. */
    public synchronized void addUsedSeconds(long seconds) {
        long delta = Math.max(0, seconds);
        if (delta == 0) return;
        rollMirrorIfNewDay();
        loadRedisBaseline();
        mirrorSeconds += delta;
        pendingSeconds += delta;
        flushPending();
    }

    private void flushPending() {
        if (pendingSeconds == 0) return;
        long pending = pendingSeconds;
        try {
            Long persisted = redis.opsForValue().increment(key(), pending);
            pendingSeconds -= pending;
            if (persisted != null) mirrorSeconds = Math.max(mirrorSeconds, persisted);
            redisBaselineLoaded = true;
        } catch (Exception e) {
            degrade("addUsedSeconds", e);
            return;
        }
        try {
            redis.expire(key(), KEY_TTL_DAYS, TimeUnit.DAYS);
        } catch (Exception e) {
            // INCR 은 이미 성공했다. TTL 실패를 증가분 실패로 취급하면 다음 호출에서 이중 반영된다.
            degrade("expire", e);
        }
    }

    public synchronized int usedMinutes() {
        return (int) (currentUsedSeconds() / 60);
    }

    public int dailyBudgetMinutes() {
        return dailyBudgetMinutes;
    }

    /** 오늘 사용한 초 = Redis 기준값 + 아직 동기화하지 못한 증가분. Redis 불가면 보수적 미러를 유지한다. */
    private long currentUsedSeconds() {
        rollMirrorIfNewDay();
        loadRedisBaseline();
        // 장애가 복구된 뒤 새 사용량이 생기지 않아도 조회 시점에 미동기화분을 밀어 넣는다.
        flushPending();
        return mirrorSeconds;
    }

    private void loadRedisBaseline() {
        if (redisBaselineLoaded) return;
        try {
            String v = redis.opsForValue().get(key());
            long fromRedis = v == null ? 0L : Long.parseLong(v);
            mirrorSeconds = Math.max(mirrorSeconds, fromRedis + pendingSeconds);
            redisBaselineLoaded = true;
        } catch (Exception e) {
            degrade("read", e);
        }
    }

    private String key() {
        return KEY_PREFIX + LocalDate.now(SEOUL).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private void rollMirrorIfNewDay() {
        LocalDate today = LocalDate.now(SEOUL);
        if (!today.equals(mirrorDay)) {
            mirrorDay = today;
            mirrorSeconds = 0;
            pendingSeconds = 0;
            redisBaselineLoaded = false;
        }
    }

    private void degrade(String op, Exception e) {
        log.warn("[CrawlBudget] Redis 불가({}) — 인메모리 폴백 사용: {}", op, e.toString());
    }
}
