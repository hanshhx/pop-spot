package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 아직 번역하지 않은 팝업을 훑어 영어·일본어 표시명을 채운다.
 *
 * <p>이미 쌓인 1,400여 건을 한 번에 처리하면 LLM 한도를 통째로 쓰고, 그 시간 동안 정작 수집이 막힌다. 그래서 한 번에 상한만큼만 하고 매일 조금씩 밀어 나간다.
 * 새로 수집되는 팝업은 크롤 직후 함께 번역되므로 (경위는 {@link PopupCrawlOrchestrator}) 이 작업은 <b>과거분을 메우는 용도</b>다.
 *
 * <p>실패해도 조용히 넘어간다 — 번역은 없으면 한국어 원문이 나오는 <b>있으면 좋은 것</b>이라, 못 했다고 다른 작업까지 세울 이유가 없다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupTranslationBackfillService {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;

    /**
     * 한 회차 상한.
     *
     * <p>한 번에 20건씩 묶어 부르므로 100이면 호출 5회다. 크롤 정규화와 같은 한도를 나눠 쓰기 때문에 넉넉히 잡으면 수집이 밀린다.
     */
    @Value("${popspot.crawler.translation-backfill-limit:100}")
    private int limit;

    private final PopupStoreRepository popupStoreRepository;
    private final PopupTranslationService translationService;

    /**
     * 새벽에 한 번. 크롤(04시)보다 뒤에 둬서, 그날 새로 들어온 팝업이 이미 번역된 상태로 지나가게 한다.
     *
     * <p>{@code zone} 을 명시하는 이유는 운영 서버가 UTC 라 그냥 두면 한국 시간 기준이 아니게 된다.
     */
    @Scheduled(
            cron = "${popspot.crawler.translation-backfill-cron:0 40 5 * * *}",
            zone = "Asia/Seoul")
    public void scheduled() {
        try {
            runOnce();
        } catch (Exception e) {
            log.warn("[TranslationBackfill] 예약 실행 실패 — 다음 회차에 다시 시도: {}", e.getMessage());
        }
    }

    /**
     * 한 회차 실행.
     *
     * @return 통계(대상 / 번역됨 / 확신 없어 비움)
     */
    public Map<String, Integer> runOnce() {
        String today = LocalDate.now(SEOUL).format(ISO);
        List<PopupStore> targets =
                popupStoreRepository.findTranslationTargets(today, Math.max(1, limit));

        Map<String, Integer> stats = new LinkedHashMap<>();
        if (targets.isEmpty()) {
            log.info("[TranslationBackfill] 대상 없음 — 모두 처리됨");
            stats.put("targets", 0);
            stats.put("attempted", 0);
            stats.put("translated", 0);
            stats.put("skipped", 0);
            stats.put("deferred", 0);
            return stats;
        }

        log.info("[TranslationBackfill] 시작 — 대상 {}건", targets.size());
        Map<Long, PopupTranslationService.Translated> result =
                translationService.translate(targets);
        int filled = translationService.applyAll(targets, result);

        // LLM 호출 동안 DB 트랜잭션과 커넥션을 붙잡지 않는다. 정상 응답이 있었던 행만 짧게 저장한다.
        // 호출 실패·깨진 응답·누락된 id는 translatedAt을 건드리지 않아 다음 회차에서 다시 시도된다.
        List<PopupStore> attempted =
                targets.stream().filter(popup -> result.containsKey(popup.getId())).toList();
        if (!attempted.isEmpty()) {
            popupStoreRepository.saveAll(attempted);
        }

        stats.put("targets", targets.size());
        stats.put("attempted", attempted.size());
        stats.put("translated", filled);
        stats.put("skipped", attempted.size() - filled);
        stats.put("deferred", targets.size() - attempted.size());
        log.info(
                "[TranslationBackfill] 완료 — 대상 {}건 · 정상응답 {}건 · 번역 {}건 · 확신없어 비움 {}건 · 재시도 {}건",
                targets.size(),
                attempted.size(),
                filled,
                attempted.size() - filled,
                targets.size() - attempted.size());
        return stats;
    }
}
