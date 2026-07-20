package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.SearchService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 매일 새벽 5시(KST) 만료된 팝업을 일괄 EXPIRED 처리하는 cron job.
 *
 * <p>실제 row 는 삭제하지 않는다 (이력/랭킹/방문기록 보존). 캘린더/검색/랭킹은 Repository 쿼리에서 EXPIRED 를 제외하므로 사용자 입장에서는 자동으로
 * 사라진 효과.
 *
 * <p>v2.13 — EXPIRED 로 바뀐 row 는 Algolia 인덱스에서도 즉시 제거해 SearchBox 에 노출되지 않게 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PopupExpireScheduler {

    private final PopupStoreRepository popupStoreRepository;
    private final SearchService searchService;

    @Scheduled(cron = "0 0 5 * * *", zone = "Asia/Seoul")
    @Transactional
    public void scheduledExpire() {
        // KST 를 명시한다. cron 의 zone 은 "언제 실행할지" 만 정하고 LocalDate.now() 는 JVM 기본
        // 시간대를 따르는데, 운영 서버가 UTC 면 05:00 KST 실행 시점의 UTC 날짜는 전날이다.
        // 그러면 findToExpire(어제) 가 되어 "어제 끝난 팝업" 이 만료 대상에서 빠지고, 하루 늦게
        // 처리된다 — 종료된 팝업이 계속 노출되던 원인.
        String today = PopupStoreRepository.todayKst();
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
