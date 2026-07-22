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
 * 네이버·카카오 검색 API 의 하루 호출량을 추적하고 상한(기본 일일 한도의 50%)을 지킨다.
 *
 * <p><b>왜 필요한가.</b> 로컬 Ollama 로 크롤이 무제한이 되면 LLM 병목이 사라지는 대신 검색 API 가 새 병목이 된다. 검색을 무제한으로 돌리면 일일 한도를
 * 넘겨 크롤 자체가 막힌다. 한도의 절반까지만 쓰도록 상한을 둬, 사람이 쓰는 다른 검색 여유를 남기고 초과로 인한 차단을 막는다.
 *
 * <p><b>Redis 영속(재시작 생존).</b> 예전엔 메모리라 백엔드 재시작마다 카운터가 0 이 됐다 — 재배포·크래시가 잦으면 하루 호출량이 상한을 넘어 검색 API 가
 * 차단될 수 있었다. 이제 KST 날짜를 키에 넣은 Redis 카운터({@code crawl:budget:naver|kakao:YYYY-MM-DD})에 누적한다. 재시작해도
 * 이어지고, 자정에 날짜-키가 바뀌어 자연 리셋된다({@link CrawlBudgetTracker} 와 동일 발상).
 *
 * <p><b>Redis 불가 시 폴백.</b> Redis 기준값과 장애 중 미동기화 증가분을 분리한다. 복구되면 증가분 전량을 INCR 로 합치므로 재시작→Redis 장애가
 * 이어져도 이전 인스턴스 사용량과 장애 중 사용량 중 하나를 잃지 않는다({@link CrawlBudgetTracker} 와 동일 설계).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SearchApiBudgetTracker {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final String KEY_NAVER = "crawl:budget:naver:";
    private static final String KEY_KAKAO = "crawl:budget:kakao:";

    /** 날짜별 키의 자동 정리용 TTL. 날짜-키가 리셋을 담당하므로 넉넉히 잡는다. */
    private static final long KEY_TTL_DAYS = 2;

    /** Spring Boot 오토컨피그 빈. 앱 전역이 이미 이 타입을 쓴다. */
    private final StringRedisTemplate redis;

    @Value("${popspot.crawler.search.naver-daily-limit:25000}")
    private int naverDailyLimit;

    @Value("${popspot.crawler.search.kakao-daily-limit:30000}")
    private int kakaoDailyLimit;

    /** 일일 한도 대비 사용 상한 비율. 0.5 = 절반까지만. */
    @Value("${popspot.crawler.search.usage-ratio:0.5}")
    private double usageRatio;

    /** Redis 기준값 + 이 JVM 증가분. 날짜가 바뀌면 리셋한다. */
    private volatile LocalDate mirrorDay = LocalDate.now(SEOUL);

    private final Counter mirrorNaver = new Counter();
    private final Counter mirrorKakao = new Counter();

    private static class Counter {
        long total;
        long pending;
        boolean baselineLoaded;
    }

    /** 두 API 모두 상한 안이면 true. 하나라도 상한에 닿으면 false(크롤 중단 신호). */
    public synchronized boolean withinBudget() {
        return withinBudget(0, 0);
    }

    /** 다음 작업의 예상 호출 수까지 더해도 상한을 넘지 않는가. 검사 뒤 2회 기록해 상한을 1회 초과하던 경계를 막는다. */
    public synchronized boolean withinBudget(int nextNaverCalls, int nextKakaoCalls) {
        long nextNaver = Math.max(0, nextNaverCalls);
        long nextKakao = Math.max(0, nextKakaoCalls);
        return naverUsed() + nextNaver <= naverCap() && kakaoUsed() + nextKakao <= kakaoCap();
    }

    /** 이번 키워드가 쓴 채널 수를 누적한다. */
    public synchronized void record(int naverCalls, int kakaoCalls) {
        add(KEY_NAVER, mirrorNaver, Math.max(0, naverCalls));
        add(KEY_KAKAO, mirrorKakao, Math.max(0, kakaoCalls));
    }

    public synchronized long naverUsed() {
        return read(KEY_NAVER, mirrorNaver);
    }

    public synchronized long kakaoUsed() {
        return read(KEY_KAKAO, mirrorKakao);
    }

    public long naverCap() {
        return (long) (naverDailyLimit * usageRatio);
    }

    public long kakaoCap() {
        return (long) (kakaoDailyLimit * usageRatio);
    }

    /** 한 API 카운터에 delta 누적 — 미러에 항상 더하고, Redis 에는 best-effort. */
    private void add(String prefix, Counter counter, long delta) {
        if (delta == 0) return;
        rollMirrorIfNewDay();
        loadBaseline(prefix, counter);
        counter.total += delta;
        counter.pending += delta;
        flushPending(prefix, counter);
    }

    private void flushPending(String prefix, Counter counter) {
        if (counter.pending == 0) return;
        long pending = counter.pending;
        try {
            Long persisted = redis.opsForValue().increment(key(prefix), pending);
            counter.pending -= pending;
            if (persisted != null) counter.total = Math.max(counter.total, persisted);
            counter.baselineLoaded = true;
        } catch (Exception e) {
            degrade("record", e);
            return;
        }
        try {
            redis.expire(key(prefix), KEY_TTL_DAYS, TimeUnit.DAYS);
        } catch (Exception e) {
            degrade("expire", e);
        }
    }

    /** 한 API 의 오늘 사용량 = Redis 기준값 + 미동기화 증가분. */
    private long read(String prefix, Counter counter) {
        rollMirrorIfNewDay();
        loadBaseline(prefix, counter);
        // 장애 복구 뒤 추가 호출이 없어도 예산 조회가 미동기화분을 복구한다.
        flushPending(prefix, counter);
        return counter.total;
    }

    private void loadBaseline(String prefix, Counter counter) {
        if (counter.baselineLoaded) return;
        try {
            String v = redis.opsForValue().get(key(prefix));
            long fromRedis = v == null ? 0L : Long.parseLong(v);
            counter.total = Math.max(counter.total, fromRedis + counter.pending);
            counter.baselineLoaded = true;
        } catch (Exception e) {
            degrade("read", e);
        }
    }

    private String key(String prefix) {
        return prefix + LocalDate.now(SEOUL).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private void rollMirrorIfNewDay() {
        LocalDate today = LocalDate.now(SEOUL);
        if (!today.equals(mirrorDay)) {
            mirrorDay = today;
            reset(mirrorNaver);
            reset(mirrorKakao);
        }
    }

    private void reset(Counter counter) {
        counter.total = 0;
        counter.pending = 0;
        counter.baselineLoaded = false;
    }

    private void degrade(String op, Exception e) {
        log.warn("[SearchBudget] Redis 불가({}) — 인메모리 폴백 사용: {}", op, e.toString());
    }
}
