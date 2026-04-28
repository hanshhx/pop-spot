package com.example.popspotbackend.service.crawler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 매일 새벽 4시(KST) 자동수집 1회 실행.
 *
 * application.properties:
 *   popspot.crawler.enabled=true|false  (기본 false → 운영 환경에서만 명시 활성화)
 *   popspot.crawler.confidence-threshold=0.8
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PopupCrawlScheduler {

    private final PopupCrawlOrchestrator orchestrator;

    @Value("${popspot.crawler.enabled:false}")
    private boolean enabled;

    /** 매일 새벽 4시 (KST 는 PopspotBackendApplication 에서 setDefault 로 강제됨) */
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
