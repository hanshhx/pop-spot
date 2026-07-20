package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.CrawlSourceLedger;
import com.example.popspotbackend.repository.CrawlSourceLedgerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * LLM 에 넘기기 전에 "이미 본 글" 을 걸러낸다.
 *
 * <p><b>이 단계가 무료 운영의 핵심이다.</b> 검색 API 는 같은 블로그 글을 여러 키워드 결과에 실어 주고, 하루 두 번 돌면 어제 본 글도 그대로 다시 나온다.
 * 그때마다 LLM 을 호출하면 토큰 예산이 새 글을 보기도 전에 바닥난다. URL 로 먼저 걸러내면 호출 수가 "새로 올라온 글 수" 까지 떨어진다.
 *
 * <p>같은 실행 안에서의 중복도 함께 제거한다 — 키워드 A 와 B 의 결과에 같은 글이 있으면 한 번만 넘긴다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CrawlSourceLedgerService {

    /** 이 기간 동안 검색 결과에 안 보인 항목은 정리한다. */
    private static final int STALE_AFTER_DAYS = 90;

    private final CrawlSourceLedgerRepository ledgerRepository;

    /** 필터 결과 — 넘길 것과 그 이유를 함께 돌려준다. */
    public record FilterResult(
            List<PopupCrawlSource> fresh, int alreadyProcessed, int duplicateInRun) {

        public boolean isEmpty() {
            return fresh.isEmpty();
        }
    }

    /**
     * LLM 에 넘길 스니펫만 남긴다.
     *
     * <p>남기는 기준: (1) 처음 보는 URL, (2) 전에 봤지만 내용이 바뀐 글, (3) 지난번 호출이 실패해 재시도 대상인 글. 링크가 없는 스니펫은 대조할 키가
     * 없으므로 그냥 남긴다 — 판단 불가를 이유로 버리면 정보를 잃는다.
     *
     * @param seenInThisRun 같은 실행에서 이미 처리하기로 한 URL 해시. 호출자가 회차 단위로 들고 다닌다.
     */
    @Transactional(readOnly = true)
    public FilterResult filterFresh(List<PopupCrawlSource> snippets, Set<String> seenInThisRun) {
        if (snippets == null || snippets.isEmpty()) {
            return new FilterResult(List.of(), 0, 0);
        }

        // LinkedHashMap — 입력 순서가 곧 "어느 40개가 LLM 에 들어가는가" 의 선택 기준이다.
        // fetchSnippetsForKeyword 가 4채널을 라운드로빈으로 섞고 최신순으로 정렬해 둔 순서를 여기서
        // 흩으면 채널 편향이 생기고 최신 글이 뒤로 밀린다.
        Map<String, PopupCrawlSource> byHash = new LinkedHashMap<>();
        List<PopupCrawlSource> keyless = new ArrayList<>();
        int duplicateInRun = 0;

        for (PopupCrawlSource snippet : snippets) {
            String link = snippet.getLink();
            if (link == null || link.isBlank()) {
                keyless.add(snippet);
                continue;
            }
            String hash = SourceUrlNormalizer.hash(link);
            if (seenInThisRun.contains(hash) || byHash.containsKey(hash)) {
                duplicateInRun++;
                continue;
            }
            byHash.put(hash, snippet);
        }

        if (byHash.isEmpty()) {
            return new FilterResult(keyless, 0, duplicateInRun);
        }

        Map<String, CrawlSourceLedger> known = loadKnown(byHash.keySet());

        List<PopupCrawlSource> fresh = new ArrayList<>();
        int alreadyProcessed = 0;
        for (Map.Entry<String, PopupCrawlSource> entry : byHash.entrySet()) {
            CrawlSourceLedger ledger = known.get(entry.getKey());
            if (ledger == null || needsReprocess(ledger, entry.getValue())) {
                fresh.add(entry.getValue());
            } else {
                alreadyProcessed++;
            }
            // 아는 글도 회차 집합에 넣는다. 안 넣으면 인기 글 1건이 키워드 10개에 걸릴 때
            // alreadyProcessed 가 10 씩 올라 "선중복제거가 얼마를 아꼈나" 를 이 지표로 읽을 수 없다.
            seenInThisRun.add(entry.getKey());
        }
        // 링크 없는 스니펫은 뒤로 보낸다. 대조할 키가 없다는 이유로 상위 40 자리를 차지할 이유가 없다.
        fresh.addAll(keyless);
        return new FilterResult(fresh, alreadyProcessed, duplicateInRun);
    }

    /**
     * 처리 결과를 대장에 반영한다.
     *
     * <p>{@code status} 와 무관하게 {@code lastSeenAt} 은 항상 갱신한다 — "아직 살아 있는 글" 이라는 사실은 정리 기준이 되기 때문이다.
     */
    @Transactional
    public void markProcessed(List<PopupCrawlSource> snippets, String status, String modelName) {
        if (snippets == null || snippets.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now();
        Map<String, PopupCrawlSource> byHash = new LinkedHashMap<>();
        for (PopupCrawlSource snippet : snippets) {
            String link = snippet.getLink();
            if (link == null || link.isBlank()) continue;
            byHash.put(SourceUrlNormalizer.hash(link), snippet);
        }
        if (byHash.isEmpty()) return;

        for (Map.Entry<String, PopupCrawlSource> entry : byHash.entrySet()) {
            PopupCrawlSource snippet = entry.getValue();
            ledgerRepository.upsert(
                    entry.getKey(),
                    SourceUrlNormalizer.contentHash(snippet.getTitle(), snippet.getDescription()),
                    snippet.getSourceName(),
                    status,
                    modelName,
                    now);
        }
    }

    /** 걸러낸 글도 "오늘 검색에 나왔다" 는 사실은 남긴다. 정리 기준이 되는 값이라 갱신이 필요하다. */
    @Transactional
    public void touchSeen(List<String> sourceUrlHashes) {
        if (sourceUrlHashes == null || sourceUrlHashes.isEmpty()) return;
        ledgerRepository.touchLastSeen(sourceUrlHashes, LocalDateTime.now());
    }

    /** 오래 안 보인 항목 정리. 크롤 종료 시 호출한다. */
    @Transactional
    public int pruneStale() {
        int removed = ledgerRepository.deleteStale(LocalDateTime.now().minusDays(STALE_AFTER_DAYS));
        if (removed > 0) {
            log.info("[CrawlSourceLedger] {}일 이상 안 보인 이력 {}건 정리", STALE_AFTER_DAYS, removed);
        }
        return removed;
    }

    /* ============================== 내부 ============================== */

    private Map<String, CrawlSourceLedger> loadKnown(Set<String> hashes) {
        Map<String, CrawlSourceLedger> known = new HashMap<>();
        for (CrawlSourceLedger row :
                ledgerRepository.findBySourceUrlHashIn(new ArrayList<>(hashes))) {
            known.put(row.getSourceUrlHash(), row);
        }
        return known;
    }

    /**
     * 다시 LLM 에 넘겨야 하는가.
     *
     * <p>내용이 바뀌었거나(기간 연장·장소 변경) 지난번 호출이 실패한 경우다. {@code REJECTED} 는 재처리하지 않는다 — 팝업이 아니라고 이미 판단한 글을
     * 매번 다시 보면 그 자체가 낭비다.
     */
    private boolean needsReprocess(CrawlSourceLedger ledger, PopupCrawlSource snippet) {
        if (CrawlSourceLedger.STATUS_RETRYABLE.equals(ledger.getStatus())) return true;
        if (CrawlSourceLedger.STATUS_REJECTED.equals(ledger.getStatus())) return false;

        String currentContent =
                SourceUrlNormalizer.contentHash(snippet.getTitle(), snippet.getDescription());
        return !currentContent.equals(ledger.getContentHash());
    }

    /** 필터에서 걸러진 URL 해시 — 호출자가 touchSeen 에 쓸 수 있게. */
    public List<String> hashesOf(List<PopupCrawlSource> snippets) {
        Set<String> hashes = new HashSet<>();
        for (PopupCrawlSource snippet : snippets) {
            String link = snippet.getLink();
            if (link != null && !link.isBlank()) hashes.add(SourceUrlNormalizer.hash(link));
        }
        return new ArrayList<>(hashes);
    }
}
