package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 매일 새벽 5시(KST) 만료된 팝업 일괄 처리.
 *
 * - end_date < 오늘 → status = 'EXPIRED'
 *   (실제 row 삭제 X. 이력/랭킹 분석/사용자 방문기록 보존 목적)
 * - 기간 종료 후엔 캘린더/검색/랭킹/메인 모두에서 자동으로 사라짐 (Repository 쿼리가 EXPIRED 제외)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PopupExpireScheduler {

    private final PopupStoreRepository popupStoreRepository;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;

    @Scheduled(cron = "0 0 5 * * *", zone = "Asia/Seoul")
    @Transactional
    public void scheduledExpire() {
        String today = LocalDate.now().format(ISO);
        List<PopupStore> targets = popupStoreRepository.findToExpire(today);
        if (targets.isEmpty()) {
            log.debug("[PopupExpireScheduler] 만료 대상 없음 (today={})", today);
            return;
        }
        List<Long> ids = targets.stream().map(PopupStore::getId).toList();
        int updated = popupStoreRepository.markExpired(ids);
        log.info("[PopupExpireScheduler] {}개 팝업 EXPIRED 처리 (today={})", updated, today);
    }
}
