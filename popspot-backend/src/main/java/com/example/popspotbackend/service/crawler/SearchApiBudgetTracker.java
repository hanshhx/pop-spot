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
 * 네이버·카카오 검색 API 의 하루 호출량을 추적하고 상한(기본 일일 한도의 50%)을 지킨다.
 *
 * <p><b>왜 필요한가.</b> 로컬 Ollama 로 크롤이 무제한이 되면 LLM 병목이 사라지는 대신 검색 API 가 새 병목이 된다. 검색을 무제한으로 돌리면 일일 한도를
 * 넘겨 크롤 자체가 막힌다. 한도의 절반까지만 쓰도록 상한을 둬, 사람이 쓰는 다른 검색 여유를 남기고 초과로 인한 차단을 막는다.
 *
 * <p><b>Redis 영속(재시작 생존).</b> 예전엔 메모리라 백엔드 재시작마다 카운터가 0 이 됐다 — 재배포·크래시가 잦으면 하루 호출량이 상한을 넘어 검색 API 가
 * 차단될 수 있었다. 이제 KST 날짜를 키에 넣은 Redis 카운터({@code crawl:budget:naver|kakao:YYYY-MM-DD})에 누적한다. 재시작해도
 * 이어지고, 자정에 날짜-키가 바뀌어 자연 리셋된다({@link CrawlBudgetTracker} 와 동일 발상).
 *
 * <p><b>Redis 불가 시 폴백 — 미러 + max 읽기.</b> 크롤 핫패스라 Redis 다운이 크롤을 죽이면 안 된다. 인메모리 미러에 <b>항상</b> 누적하고 (=
 * 이 JVM 이 오늘 센 전량) Redis 에는 best-effort 로 누적하며, 읽을 때 {@code max(redis, mirror)} 를 쓴다. 합산이 아니라 max 라
 * 이중계상이 없고, 재시작 후엔 Redis 값이 우세하며(크로스-재시작 보존), 아웃테이지에도 미러가 오늘 전량을 유지해 상한 체크가 무력화되지 않는다({@link
 * CrawlBudgetTracker} 와 동일 설계). 상한(50%)이 하드 한도의 절반이라 안전 여유도 크다.
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

    /** 이 JVM 이 오늘 센 전량(항상 누적하는 미러). 날짜가 바뀌면 리셋한다. */
    private volatile LocalDate mirrorDay = LocalDate.now(SEOUL);

    private final AtomicLong mirrorNaver = new AtomicLong();
    private final AtomicLong mirrorKakao = new AtomicLong();

    /** 두 API 모두 상한 안이면 true. 하나라도 상한에 닿으면 false(크롤 중단 신호). */
    public synchronized boolean withinBudget() {
        return naverUsed() < naverCap() && kakaoUsed() < kakaoCap();
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
    private void add(String prefix, AtomicLong mirror, long delta) {
        if (delta == 0) return;
        rollMirrorIfNewDay();
        mirror.addAndGet(delta);
        String key = key(prefix);
        try {
            redis.opsForValue().increment(key, delta);
            redis.expire(key, KEY_TTL_DAYS, TimeUnit.DAYS);
        } catch (Exception e) {
            degrade("record", e);
        }
    }

    /** 한 API 의 오늘 사용량 = max(Redis, 미러). 합산이 아니라 max 라 이중계상이 없다. Redis 불가면 미러만. */
    private long read(String prefix, AtomicLong mirror) {
        rollMirrorIfNewDay();
        long m = mirror.get();
        try {
            String v = redis.opsForValue().get(key(prefix));
            long fromRedis = v == null ? 0L : Long.parseLong(v);
            return Math.max(fromRedis, m);
        } catch (Exception e) {
            degrade("read", e);
            return m;
        }
    }

    private String key(String prefix) {
        return prefix + LocalDate.now(SEOUL).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private void rollMirrorIfNewDay() {
        LocalDate today = LocalDate.now(SEOUL);
        if (!today.equals(mirrorDay)) {
            mirrorDay = today;
            mirrorNaver.set(0);
            mirrorKakao.set(0);
        }
    }

    private void degrade(String op, Exception e) {
        log.warn("[SearchBudget] Redis 불가({}) — 인메모리 폴백 사용: {}", op, e.toString());
    }
}
