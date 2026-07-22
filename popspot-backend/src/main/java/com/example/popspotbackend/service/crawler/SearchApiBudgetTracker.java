package com.example.popspotbackend.service.crawler;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 네이버·카카오 검색 API 의 하루 호출량을 추적하고 상한(기본 일일 한도의 50%)을 지킨다.
 *
 * <p><b>왜 필요한가.</b> 로컬 Ollama 로 크롤이 무제한이 되면 LLM 병목이 사라지는 대신 검색 API 가 새 병목이 된다. 검색을 무제한으로 돌리면 일일 한도를
 * 넘겨 크롤 자체가 막힌다. 한도의 절반까지만 쓰도록 상한을 둬, 사람이 쓰는 다른 검색 여유를 남기고 초과로 인한 차단을 막는다.
 *
 * <p><b>메모리 저장, 자정(KST) 리셋.</b> {@link CrawlBudgetTracker} 와 같은 이유로 메모리로 충분하다.
 */
@Slf4j
@Component
public class SearchApiBudgetTracker {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    @Value("${popspot.crawler.search.naver-daily-limit:25000}")
    private int naverDailyLimit;

    @Value("${popspot.crawler.search.kakao-daily-limit:30000}")
    private int kakaoDailyLimit;

    /** 일일 한도 대비 사용 상한 비율. 0.5 = 절반까지만. */
    @Value("${popspot.crawler.search.usage-ratio:0.5}")
    private double usageRatio;

    private volatile LocalDate day = LocalDate.now(SEOUL);
    private final AtomicLong naverUsed = new AtomicLong();
    private final AtomicLong kakaoUsed = new AtomicLong();

    /** 두 API 모두 상한 안이면 true. 하나라도 상한에 닿으면 false(크롤 중단 신호). */
    public synchronized boolean withinBudget() {
        rollIfNewDay();
        return naverUsed.get() < naverCap() && kakaoUsed.get() < kakaoCap();
    }

    /** 이번 키워드가 쓴 채널 수를 누적한다. */
    public synchronized void record(int naverCalls, int kakaoCalls) {
        rollIfNewDay();
        naverUsed.addAndGet(Math.max(0, naverCalls));
        kakaoUsed.addAndGet(Math.max(0, kakaoCalls));
    }

    public long naverUsed() {
        return naverUsed.get();
    }

    public long kakaoUsed() {
        return kakaoUsed.get();
    }

    public long naverCap() {
        return (long) (naverDailyLimit * usageRatio);
    }

    public long kakaoCap() {
        return (long) (kakaoDailyLimit * usageRatio);
    }

    private void rollIfNewDay() {
        LocalDate today = LocalDate.now(SEOUL);
        if (!today.equals(day)) {
            log.info(
                    "[SearchBudget] 새 날({}) — 카운터 리셋(전일 네이버 {} / 카카오 {})",
                    today,
                    naverUsed.get(),
                    kakaoUsed.get());
            day = today;
            naverUsed.set(0);
            kakaoUsed.set(0);
        }
    }
}
