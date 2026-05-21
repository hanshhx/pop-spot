package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.SearchService;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 매일 새벽 5시(KST) 만료된 팝업을 일괄 EXPIRED 처리하는 cron job.
 *
 * <p>실제 row 는 삭제하지 않는다 (이력/랭킹/방문기록 보존). 캘린더/검색/랭킹은 Repository 쿼리에서
 * EXPIRED 를 제외하므로 사용자 입장에서는 자동으로 사라진 효과.
 *
 * <p>v2.13 — EXPIRED 로 바뀐 row 는 Algolia 인덱스에서도 즉시 제거해 SearchBox 에 노출되지 않게 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PopupExpireScheduler {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final PopupStoreRepository popupStoreRepository;
    private final SearchService searchService;

    @Scheduled(cron = "0 0 5 * * *", zone = "Asia/Seoul")
    @Transactional
    public void scheduledExpire() {
        String today = LocalDate.now().format(ISO_DATE);
        List<PopupStore> targets = popupStoreRepository.findToExpire(today);

        if (targets.isEmpty()) {
            log.debug("[PopupExpireScheduler] 만료 대상 없음 (today={})", today);
            return;
        }

        List<Long> targetIds = targets.stream().map(PopupStore::getId).toList();
        int updatedCount = popupStoreRepository.markExpired(targetIds);
        log.info("[PopupExpireScheduler] {}개 팝업 EXPIRED 처리 (today={})", updatedCount, today);

        for (Long id : targetIds) {
            try {
                searchService.removePopup(id);
            } catch (Exception e) {
                log.warn("[PopupExpireScheduler] Algolia 삭제 실패 id={} err={}", id, e.toString());
            }
        }
    }
}
