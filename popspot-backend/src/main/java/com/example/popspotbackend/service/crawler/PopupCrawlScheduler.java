package com.example.popspotbackend.service.crawler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 매일 새벽 4시(KST) 자동수집 1회 실행하는 cron job.
 *
 * <p>설정 키:
 *
 * <ul>
 *   <li>{@code popspot.crawler.enabled} — 운영 환경에서만 true (기본 false)
 *   <li>{@code popspot.crawler.cron} — cron 표현식 변경 가능
 *   <li>{@code popspot.crawler.confidence-threshold} — 자동게시 신뢰도 임계값
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PopupCrawlScheduler {

    private final PopupCrawlOrchestrator orchestrator;

    @Value("${popspot.crawler.enabled:false}")
    private boolean enabled;

    @Scheduled(cron = "${popspot.crawler.cron:0 0 4 * * *}", zone = "Asia/Seoul")
    public void scheduledRun() {
        if (!enabled) {
            log.debug("[PopupCrawlScheduler] disabled — 스킵");
            return;
        }

        log.info("[PopupCrawlScheduler] === 일일 자동수집 시작 ===");
        try {
            orchestrator.runOnce();
        } catch (Exception e) {
            log.error("[PopupCrawlScheduler] 실행 실패", e);
        }
    }
}
