package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.CrawlSourceLedger;
import com.example.popspotbackend.repository.CrawlSourceLedgerRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CrawlSourceLedgerServiceTest {

    @Test
    void 날짜_재처리는_cooldown을_지난_가장_오래된_원문만_limit만큼_큐에_넣는다() {
        CrawlSourceLedgerRepository repository = mock(CrawlSourceLedgerRepository.class);
        CrawlSourceLedgerService service = new CrawlSourceLedgerService(repository);
        LocalDateTime now = LocalDateTime.of(2026, 7, 22, 12, 0);

        String oldest = SourceUrlNormalizer.hash("https://example.com/oldest");
        String old = SourceUrlNormalizer.hash("https://example.com/old");
        String recent = SourceUrlNormalizer.hash("https://example.com/recent");
        when(repository.findBySourceUrlHashIn(any()))
                .thenReturn(
                        List.of(
                                ledger(oldest, now.minusDays(30)),
                                ledger(old, now.minusDays(20)),
                                ledger(recent, now.minusDays(1))));
        when(repository.markDateBackfillRetryable(any(), any())).thenReturn(2);

        int queued =
                service.requeueDateBackfill(
                        List.of(
                                "https://example.com/oldest",
                                "https://example.com/old",
                                "https://example.com/recent"),
                        now.minusDays(7),
                        2);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> hashes = ArgumentCaptor.forClass(List.class);
        verify(repository).markDateBackfillRetryable(hashes.capture(), eq(now.minusDays(7)));
        assertThat(queued).isEqualTo(2);
        assertThat(hashes.getValue()).containsExactly(oldest, old);
    }

    private CrawlSourceLedger ledger(String hash, LocalDateTime processedAt) {
        return CrawlSourceLedger.builder()
                .sourceUrlHash(hash)
                .status(CrawlSourceLedger.STATUS_PROCESSED)
                .lastProcessedAt(processedAt)
                .build();
    }
}
