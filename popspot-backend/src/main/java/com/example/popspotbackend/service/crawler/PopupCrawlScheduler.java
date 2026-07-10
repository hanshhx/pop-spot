package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.service.PopupPhotoService;
import com.example.popspotbackend.service.PopupStoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 자동수집 cron job.
 *
 * <p>v2.13 부터 하루 2회 실행 (04:00 + 16:00 KST). 정확도 임계값은 그대로 유지하면서 새로 등장한 팝업을 빨리 캐치해 지도 반영 건수를 늘린다.
 * cron 표현식 / 임계값 / 자동게시 상한은 모두 {@code application.properties} 에서 덮어쓸 수 있다.
 *
 * <p>설정 키:
 *
 * <ul>
 *   <li>{@code popspot.crawler.enabled} — 운영 환경에서만 true (기본 false)
 *   <li>{@code popspot.crawler.cron} — 1차 실행 cron (기본 04:00)
 *   <li>{@code popspot.crawler.cron-afternoon} — 2차 실행 cron (기본 16:00)
 *   <li>{@code popspot.crawler.confidence-threshold} — 자동게시 신뢰도 임계값
 *   <li>{@code popspot.crawler.geocode-backfill-cron} — 좌표 누락 row 백필 cron (기본 04:30)
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PopupCrawlScheduler {

    private final PopupCrawlOrchestrator orchestrator;
    private final PopupStoreService popupStoreService;
    private final PopupPhotoService popupPhotoService;

    @Value("${popspot.crawler.enabled:false}")
    private boolean enabled;

    @Value("${popspot.photo.backfill-limit:150}")
    private int photoBackfillLimit;

    @Scheduled(cron = "${popspot.crawler.cron:0 0 4 * * *}", zone = "Asia/Seoul")
    public void scheduledRunMorning() {
        runIfEnabled("morning");
    }

    @Scheduled(cron = "${popspot.crawler.cron-afternoon:0 0 16 * * *}", zone = "Asia/Seoul")
    public void scheduledRunAfternoon() {
        runIfEnabled("afternoon");
    }

    /** 좌표 누락된 자동수집 row 일괄 백필. 매일 04:30 — 본 수집 직후라 새로 들어온 row 중 좌표가 빠진 것들을 따로 채워 지도 노출량을 늘린다. */
    @Scheduled(cron = "${popspot.crawler.geocode-backfill-cron:0 30 4 * * *}", zone = "Asia/Seoul")
    public void scheduledGeocodeBackfill() {
        if (!enabled) {
            log.debug("[PopupCrawlScheduler] geocode-backfill disabled — 스킵");
            return;
        }
        log.info("[PopupCrawlScheduler] === Geocoding 자동 백필 시작 ===");
        try {
            int filled = orchestrator.geocodeMissing();
            log.info("[PopupCrawlScheduler] Geocoding 자동 백필 완료 — {}개 좌표 채움", filled);
        } catch (Exception e) {
            log.error("[PopupCrawlScheduler] Geocoding 백필 실패", e);
        }
    }

    /**
     * 이미지 없는 공개 팝업에 Pexels 커버 배정. 매일 04:45 — 본 수집·지오코딩 직후라 새로 들어온 팝업의 커버를 채운다. Pexels 키 미설정이면
     * 서비스 레이어에서 스킵된다.
     */
    @Scheduled(cron = "${popspot.photo.backfill-cron:0 45 4 * * *}", zone = "Asia/Seoul")
    public void scheduledPhotoBackfill() {
        if (!enabled) {
            log.debug("[PopupCrawlScheduler] photo-backfill disabled — 스킵");
            return;
        }
        log.info("[PopupCrawlScheduler] === 팝업 커버 백필 시작 ===");
        try {
            int filled = popupPhotoService.backfillMissingPhotos(photoBackfillLimit);
            log.info("[PopupCrawlScheduler] 팝업 커버 백필 완료 — {}개 배정", filled);
        } catch (Exception e) {
            log.error("[PopupCrawlScheduler] 커버 백필 실패", e);
        }
    }

    private void runIfEnabled(String slot) {
        if (!enabled) {
            log.debug("[PopupCrawlScheduler] disabled — {} 스킵", slot);
            return;
        }
        log.info("[PopupCrawlScheduler] === {} 자동수집 시작 ===", slot);
        try {
            orchestrator.runOnce();
            // v2.21-S3 — Orchestrator 가 Repository.save() 직접 호출이라 @CacheEvict 미발동.
            // 명시적으로 popups-visible / popups-hot 캐시 비워 BROWSE / 지도 즉시 갱신.
            popupStoreService.evictPopupCaches();
            log.info("[PopupCrawlScheduler] {} 자동수집 완료 — 캐시 evict", slot);
        } catch (Exception e) {
            log.error("[PopupCrawlScheduler] {} 실행 실패", slot, e);
        }
    }
}
