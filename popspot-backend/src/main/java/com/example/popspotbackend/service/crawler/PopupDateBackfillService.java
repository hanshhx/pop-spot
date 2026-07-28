package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 날짜가 빈 자동수집 팝업의 <b>원본 글 본문</b>을 읽어 운영 기간을 채운다.
 *
 * <p>v2.46 — 1차 수집은 검색 API 의 짧은 요약문만 본다. 실측(호출 30회·팝업 76개)에서 날짜를 못 뽑은 34건 중 <b>24건(71%)이 "요약문에 기간이
 * 아예 없어서"</b> 였다. 프롬프트로는 없는 정보를 만들 수 없어, 결손분만 골라 원본 글을 한 번 더 읽는다.
 *
 * <p>기대치는 부풀리지 않는다 — 원본 19건을 직접 열어 보니 기간 표현이 있는 것은 <b>5건(26%)</b>이었다. 나머지는 포스터 <b>이미지</b>에 박혀 있어
 * 글자로는 못 읽는다. 즉 26% 가 이 방식의 천장이다.
 *
 * <p>비용은 거의 없다. 본문을 LLM 에 넘기지 않고 정규식으로 기간만 뽑는다 ({@link PopupBodyDateExtractor}) — 실측에서 정규식만으로 충분했다.
 *
 * <p><b>틀린 날짜를 넣느니 비워 둔다.</b> v2.45 이후 날짜 없는 팝업은 화면에 안 나오므로, 잘못 채우면 닫힌 팝업이 열린 것처럼 보인다. 추출기가 애매한 후보를
 * 전부 버리도록 만든 이유다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupDateBackfillService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;

    /** 한 번에 처리할 최대 건수. 외부 사이트를 순차로 읽으므로 상한을 둔다. */
    @Value("${popspot.crawler.body-date-backfill-limit:80}")
    private int limit;

    /** 원본 사이트에 부담을 주지 않기 위한 요청 간격. */
    @Value("${popspot.crawler.body-date-backfill-interval-ms:400}")
    private long intervalMs;

    private final PopupStoreRepository popupStoreRepository;
    private final SourceBodyFetcher bodyFetcher;
    private final PopupBodyDateExtractor extractor;

    /**
     * 결손분을 훑어 기간을 채운다.
     *
     * @return 처리 통계(대상 / 본문 조회 성공 / 채움 / 기간 못 찾음)
     */
    public Map<String, Integer> runOnce() {
        // 값어치(종료일만 빈 = 지금 보이는 팝업) 순으로 나눈 뒤 그 안에서 무작위로 뽑는다.
        // 경위는 findDateBackfillTargets 주석 — 예전에는 오래된 순 전체를 받아 앞에서 잘랐는데,
        // 못 채운 것들이 매번 같은 자리를 차지해 나머지 800여 건에 도달하지 못했다.
        List<PopupStore> targets = popupStoreRepository.findDateBackfillTargets(Math.max(1, limit));

        if (targets.isEmpty()) {
            log.info("[BodyDateBackfill] 대상 없음");
            return Map.of("targets", 0, "fetched", 0, "filled", 0, "noPeriod", 0);
        }

        // 0순위(종료일만 빈 = 지금 보이는 팝업)가 몇 건 섞였는지 남긴다. 이 값이 낮으면 우선순위가
        // 제대로 안 먹은 것이고, 회수율이 올랐는지도 어느 쪽에서 올랐는지 구분할 수 없다.
        long visibleTargets =
                targets.stream()
                        .filter(p -> !isBlank(p.getStartDate()) && isBlank(p.getEndDate()))
                        .count();
        log.info("[BodyDateBackfill] 시작 — 대상 {}건 (그중 종료일만 빈 것 {}건)", targets.size(), visibleTargets);

        int fetched = 0;
        int filled = 0;
        int noPeriod = 0;

        for (PopupStore popup : targets) {
            Optional<String> body = bodyFetcher.fetchText(popup.getSourceUrl());
            sleepQuietly();
            if (body.isEmpty()) continue;
            fetched++;

            // 연도 보충 기준: 수집 시각이 그 글을 본 시점이라 가장 가깝다.
            LocalDate reference =
                    popup.getCrawledAt() != null
                            ? popup.getCrawledAt().toLocalDate()
                            : LocalDate.now();

            Optional<PopupBodyDateExtractor.Period> period =
                    extractor.extract(body.get(), reference);
            if (period.isEmpty()) {
                noPeriod++;
                continue;
            }

            if (applyPeriod(popup, period.get())) filled++;
        }

        log.info(
                "[BodyDateBackfill] 완료 — 대상 {} (종료일만 빈 것 {}) / 본문조회 {} / 채움 {} / 기간없음 {}",
                targets.size(),
                visibleTargets,
                fetched,
                filled,
                noPeriod);

        return Map.of(
                "targets", targets.size(),
                "visibleTargets", (int) visibleTargets,
                "fetched", fetched,
                "filled", filled,
                "noPeriod", noPeriod);
    }

    /**
     * 비어 있는 쪽만 채운다 — 이미 있는 값은 건드리지 않는다.
     *
     * <p>1차 수집이 뽑은 값이 본문에서 읽은 것보다 정확할 수 있고(그 팝업을 직접 가리킨 문장에서 뽑았다), 덮어쓰면 되돌릴 방법이 없다.
     */
    private boolean applyPeriod(PopupStore popup, PopupBodyDateExtractor.Period period) {
        boolean changed = false;

        if (isBlank(popup.getStartDate()) && period.start() != null) {
            popup.setStartDate(period.start().format(ISO));
            changed = true;
        }
        if (isBlank(popup.getEndDate()) && period.end() != null) {
            popup.setEndDate(period.end().format(ISO));
            changed = true;
        }
        if (!changed) return false;

        // 채우고 나서 역전이면 둘 다 못 믿는다 — 원래대로 되돌린다.
        if (!isBlank(popup.getStartDate())
                && !isBlank(popup.getEndDate())
                && popup.getStartDate().compareTo(popup.getEndDate()) > 0) {
            log.debug(
                    "[BodyDateBackfill] 역전 구간 — 되돌림 id={} {} > {}",
                    popup.getId(),
                    popup.getStartDate(),
                    popup.getEndDate());
            return false;
        }

        popupStoreRepository.save(popup);
        log.debug(
                "[BodyDateBackfill] 채움 id={} {} ~ {} ({})",
                popup.getId(),
                popup.getStartDate(),
                popup.getEndDate(),
                popup.getName());
        return true;
    }

    private void sleepQuietly() {
        try {
            Thread.sleep(Math.max(0, intervalMs));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
