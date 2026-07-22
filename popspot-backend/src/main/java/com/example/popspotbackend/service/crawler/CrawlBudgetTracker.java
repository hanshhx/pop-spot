package com.example.popspotbackend.service.crawler;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 로컬 Ollama 로 크롤에 쓴 하루 시간을 추적한다(기본 상한 3시간).
 *
 * <p><b>왜 필요한가.</b> PC(4060 Ti)를 하루 종일 켜둬도 크롤이 종일 GPU 를 잡으면 부담이다. 그래서 하루 크롤 시간을 예산으로 묶는다 — PC 를 껐다
 * 켜도 누적이 이어지고, 예산을 다 쓰면 그날은 더 돌지 않는다. 커서 덕분에 다음 날 이어서 순회한다.
 *
 * <p><b>메모리 저장.</b> 백엔드(시놀로지)는 24/7 이라 재시작이 드물어 메모리로 충분하다. 자정(KST)에 리셋한다. 완벽한 영속화(백엔드 재시작 시 유지)가
 * 필요해지면 DB 로 옮긴다.
 */
@Slf4j
@Component
public class CrawlBudgetTracker {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /** 하루 로컬 크롤 예산(분). 3시간이면 로컬 처리량으로 신규 팝업을 다 잡고도 남는다. */
    @Value("${popspot.crawler.local.daily-budget-minutes:180}")
    private int dailyBudgetMinutes;

    private volatile LocalDate day = LocalDate.now(SEOUL);
    private final AtomicLong usedSeconds = new AtomicLong();

    /** 오늘 예산이 남았는가. 새 날이면 먼저 리셋한다. */
    public synchronized boolean hasBudgetLeft() {
        rollIfNewDay();
        return usedSeconds.get() < dailyBudgetMinutes * 60L;
    }

    /** 이번 크롤이 쓴 시간을 누적한다. */
    public synchronized void addUsedSeconds(long seconds) {
        rollIfNewDay();
        usedSeconds.addAndGet(Math.max(0, seconds));
    }

    public int usedMinutes() {
        return (int) (usedSeconds.get() / 60);
    }

    public int dailyBudgetMinutes() {
        return dailyBudgetMinutes;
    }

    private void rollIfNewDay() {
        LocalDate today = LocalDate.now(SEOUL);
        if (!today.equals(day)) {
            log.info("[CrawlBudget] 새 날({}) — 예산 리셋(전일 {}분 사용)", today, usedMinutes());
            day = today;
            usedSeconds.set(0);
        }
    }
}
