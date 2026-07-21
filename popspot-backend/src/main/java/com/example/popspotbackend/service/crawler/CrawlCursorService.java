package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.CrawlCursor;
import com.example.popspotbackend.repository.CrawlCursorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 크롤 키워드 순회 커서 관리.
 *
 * <p><b>독립 트랜잭션인 이유.</b> {@code PopupCrawlOrchestrator.runOnce()} 는 일부러 트랜잭션 없이 돌아(1~2분 걸리는 작업을 단일
 * 거대 트랜잭션으로 묶지 않으려고), 각 저장이 독립 트랜잭션이다. 커서도 같은 방식으로 자기 트랜잭션에서 커밋한다 — LLM 이 rate limit 으로 중간에 멈춰 크롤이
 * 예외로 끝나도 커서 전진은 살아남아야, 다음 회차가 다음 구간을 본다.
 */
@Service
@RequiredArgsConstructor
public class CrawlCursorService {

    private final CrawlCursorRepository repository;

    /** 이번 회차가 시작할 키워드 인덱스. 저장된 값이 없거나 키워드가 없으면 0. */
    @Transactional(readOnly = true)
    public int currentCursor(int totalKeywords) {
        if (totalKeywords <= 0) return 0;
        return repository
                .findById(CrawlCursor.SINGLETON_ID)
                .map(c -> Math.floorMod(c.getKeywordCursor(), totalKeywords))
                .orElse(0);
    }

    /**
     * 이번 회차가 담당한 키워드 수만큼 커서를 앞으로 민다.
     *
     * <p>검색 구간을 정한 직후에 부른다 — LLM 처리 성공 여부와 무관하게 전진해야 한다. 처리하지 못한 글은 대장에 RETRYABLE 로 남아 커서가 한 바퀴 돌아올
     * 때 다시 처리된다. 전진을 처리 성공에 묶으면 rate limit 이 심한 날 커서가 멈춰 앞부분에 다시 고착된다.
     */
    @Transactional
    public void advance(int coveredKeywords, int totalKeywords) {
        if (totalKeywords <= 0 || coveredKeywords <= 0) return;
        CrawlCursor cursor =
                repository
                        .findById(CrawlCursor.SINGLETON_ID)
                        .orElseGet(
                                () -> {
                                    CrawlCursor fresh = new CrawlCursor();
                                    fresh.setId(CrawlCursor.SINGLETON_ID);
                                    fresh.setKeywordCursor(0);
                                    return fresh;
                                });
        cursor.setKeywordCursor(
                Math.floorMod(cursor.getKeywordCursor() + coveredKeywords, totalKeywords));
        repository.save(cursor);
    }
}
