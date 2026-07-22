package com.example.popspotbackend.service.crawler;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
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
 * <p><b>Redis 불가 시 폴백 — 미러 + max 읽기.</b> 이 트래커는 크롤 스케줄러 핫패스에서 호출되므로, Redis 다운이 크롤 전체를 죽이면 안 된다. 그래서
 * 인메모리 미러({@code mirrorSeconds})에 <b>항상</b> 누적하고(= 이 JVM 이 오늘 센 전량), Redis 에는 best-effort 로 별도
 * 누적한다. 읽을 때는 {@code max(redis, mirror)} 를 쓴다 — 합산이 아니라 max 라 둘에 같은 증가분이 들어가도 이중계상이 없고, 재시작 후엔 이전
 * 인스턴스가 남긴 Redis 값이 미러(0에서 시작)보다 커서 자연히 우세하며(크로스-재시작 보존), Redis 가 읽히지 않는 아웃테이지에도 미러가 오늘 전량을 쥐고 있어
 * 예산이 0 으로 리셋되지 않는다. Redis 예외는 모두 삼켜 크롤을 죽이지 않는다.
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

    /** 이 JVM 이 오늘 센 전량(항상 누적하는 미러). 날짜가 바뀌면 {@link #rollMirrorIfNewDay()} 가 리셋한다. */
    private volatile LocalDate mirrorDay = LocalDate.now(SEOUL);

    private final AtomicLong mirrorSeconds = new AtomicLong();

    /** 오늘 예산이 남았는가. */
    public synchronized boolean hasBudgetLeft() {
        return currentUsedSeconds() < dailyBudgetMinutes * 60L;
    }

    /** 이번 크롤이 쓴 시간을 누적한다. 미러에 항상 더하고, Redis 에는 best-effort 로 누적한다. */
    public synchronized void addUsedSeconds(long seconds) {
        long delta = Math.max(0, seconds);
        if (delta == 0) return;
        rollMirrorIfNewDay();
        mirrorSeconds.addAndGet(delta);
        String key = key();
        try {
            redis.opsForValue().increment(key, delta);
            redis.expire(key, KEY_TTL_DAYS, TimeUnit.DAYS);
        } catch (Exception e) {
            degrade("addUsedSeconds", e);
        }
    }

    public synchronized int usedMinutes() {
        return (int) (currentUsedSeconds() / 60);
    }

    public int dailyBudgetMinutes() {
        return dailyBudgetMinutes;
    }

    /** 오늘 사용한 초 = max(Redis, 미러). 합산이 아니라 max 라 이중계상이 없다. Redis 불가면 미러만. */
    private long currentUsedSeconds() {
        rollMirrorIfNewDay();
        long mirror = mirrorSeconds.get();
        try {
            String v = redis.opsForValue().get(key());
            long fromRedis = v == null ? 0L : Long.parseLong(v);
            return Math.max(fromRedis, mirror);
        } catch (Exception e) {
            degrade("read", e);
            return mirror;
        }
    }

    private String key() {
        return KEY_PREFIX + LocalDate.now(SEOUL).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private void rollMirrorIfNewDay() {
        LocalDate today = LocalDate.now(SEOUL);
        if (!today.equals(mirrorDay)) {
            mirrorDay = today;
            mirrorSeconds.set(0);
        }
    }

    private void degrade(String op, Exception e) {
        log.warn("[CrawlBudget] Redis 불가({}) — 인메모리 폴백 사용: {}", op, e.toString());
    }
}
