package com.example.popspotbackend.service;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 크롤 직후 자동 중복 정리 — 이름이 완전히 같은 중복 팝업을 주기적으로 걷어낸다.
 *
 * <p>자동수집(04:00·16:00 KST) 뒤 05:00·17:00 에 실행해, 같은 이름의 중복이 지도/검색에 남지 않게 한다. 크롤러 파일을 건드리지 않고 독립 스케줄로
 * 붙였다(수집 시점의 externalId 해시 dedup 은 위치·날짜 표기가 달라지면 놓치는 한계 보완).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PopupDedupScheduler {

    private final PopupDedupService popupDedupService;

    @Scheduled(cron = "${popspot.dedup.cron:0 10 5,17 * * *}", zone = "Asia/Seoul")
    public void autoDedup() {
        try {
            Map<String, Object> result = popupDedupService.dedupe();
            log.info("[PopupDedupScheduler] 자동 중복 정리 완료: {}", result);
        } catch (Exception e) {
            log.error("[PopupDedupScheduler] 자동 중복 정리 실패", e);
        }
    }
}
